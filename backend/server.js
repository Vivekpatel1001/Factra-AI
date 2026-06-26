import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import express from "express"
import next from "next"
import { createVerificationResult, extractVideoLinkContext, extractVideoTextWithGemini } from "./services/verification.js"
import {
  checkSupabaseConnection,
  createAuthUser as createSupabaseAuthUser,
  deleteSession as deleteSupabaseSession,
  findSession as findSupabaseSession,
  findUserByEmail as findSupabaseUserByEmail,
  insertReport as insertSupabaseReport,
  insertSession as insertSupabaseSession,
  insertUser as insertSupabaseUser,
  isSupabaseConfigured,
  listReportsForUser as listSupabaseReportsForUser,
} from "./services/supabase.js"

const loadLocalEnv = () => {
  for (const file of [".env.local", ".env"]) {
    const envPath = path.resolve(process.cwd(), file)
    if (!fs.existsSync(envPath)) continue
    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/)
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const separator = trimmed.indexOf("=")
      if (separator === -1) continue
      const key = trimmed.slice(0, separator).trim()
      const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "")
      if (key && process.env[key] === undefined) process.env[key] = value
    }
  }
}

loadLocalEnv()
const dev = process.env.NODE_ENV !== "production"
const port = Number(process.env.BACKEND_PORT || 4000)
const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://127.0.0.1:5173"
const backendDir = fileURLToPath(new URL(".", import.meta.url))
const app = next({ dev, dir: backendDir })
const handle = app.getRequestHandler()

const users = new Map()
const sessions = new Map()
const reports = []

const json = (res, status, body) => res.status(status).json(body)

function publicErrorMessage(error, fallback = "Request failed.") {
  const message = String(error?.message || error || "")
  if (/RESOURCE_EXHAUSTED|quota|rate limit|GenerateRequestsPerDay|GenerateRequestsPerMinute|429/i.test(message)) {
    return "Gemini free quota is currently exhausted. Please wait and try again later, or add a new Gemini API key/billing. Factra will use local extraction and conservative unverified results when possible."
  }
  if (/ENOTFOUND|fetch failed|network|timed out/i.test(message)) {
    return "The external service is not reachable right now. Please check your internet/API configuration and try again."
  }
  return message && message.length < 260 ? message : fallback
}
const normalizeEmail = (email = "") => String(email).trim().toLowerCase()

const hashPassword = (password, salt = crypto.randomBytes(16).toString("hex")) => {
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex")
  return `${salt}:${hash}`
}

const verifyPassword = (password, saved) => {
  const [salt, hash] = saved.split(":")
  const attempt = hashPassword(password, salt).split(":")[1]
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(attempt, "hex"))
}

const publicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  createdAt: user.createdAt,
})

const getStoredUserByEmail = async (email) => {
  if (isSupabaseConfigured()) {
    try {
      const supabaseUser = await findSupabaseUserByEmail(email)
      if (supabaseUser) {
        return {
          id: supabaseUser.id,
          name: supabaseUser.name,
          email: supabaseUser.email,
          passwordHash: supabaseUser.password_hash,
          createdAt: supabaseUser.created_at,
        }
      }
    } catch (error) {
      console.warn(`Supabase user lookup failed, using local fallback: ${error.message}`)
    }
  }
  return users.get(email) || null
}

const getUserFromToken = async (token) => {
  if (!token) return null
  if (isSupabaseConfigured()) {
    try {
      const session = await findSupabaseSession(token)
      if (session?.user) return session.user
    } catch (error) {
      console.warn(`Supabase session lookup failed, using local fallback: ${error.message}`)
    }
  }
  const session = sessions.get(token)
  return session ? users.get(session.email) : null
}
const requireAuth = async (req, res, nextMiddleware) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "")
  if (!token) return json(res, 401, { error: "Unauthorized" })

  if (isSupabaseConfigured()) {
    try {
      const session = await findSupabaseSession(token)
      if (session?.user) {
        req.user = session.user
        req.token = token
        return nextMiddleware()
      }
    } catch (error) {
      console.warn(`Supabase session lookup failed, using local fallback: ${error.message}`)
    }
  }

  const session = sessions.get(token)
  if (!session) return json(res, 401, { error: "Unauthorized" })
  req.user = users.get(session.email)
  req.token = token
  return nextMiddleware()
}

await app.prepare()

const server = express()

server.use(express.json({ limit: "35mb" }))
server.use((req, res, nextMiddleware) => {
  res.setHeader("Access-Control-Allow-Origin", frontendOrigin)
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  if (req.method === "OPTIONS") return res.sendStatus(204)
  return nextMiddleware()
})

server.get("/api/health", async (req, res) => {
  json(res, 200, {
    ok: true,
    service: "Factra AI backend",
    technologies: ["Next.js", "Express.js"],
    supabase: await checkSupabaseConnection(),
    timestamp: new Date().toISOString(),
  })
})

server.post("/api/auth/signup", async (req, res) => {
  const email = normalizeEmail(req.body.email)
  const name = String(req.body.name || "").trim()
  const password = String(req.body.password || "")

  if (!name || !email || password.length < 6) {
    return json(res, 400, { error: "Name, valid email, and 6+ character password are required." })
  }
  if (await getStoredUserByEmail(email)) {
    return json(res, 409, { error: "An account already exists for this email." })
  }

  const user = {
    id: crypto.randomUUID(),
    name,
    email,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  }
  if (isSupabaseConfigured()) {
    try {
      await insertSupabaseUser(user)
      try {
        await createSupabaseAuthUser(user, password)
      } catch (error) {
        console.warn(`Supabase Auth user creation failed. Custom app_users row was saved: ${error.message}`)
      }
    } catch (error) {
      console.warn(`Supabase user insert failed: ${error.message}`)
      return json(res, 502, { error: `Supabase user insert failed: ${error.message}` })
    }
  } else users.set(email, user)

  const token = crypto.randomUUID()
  if (isSupabaseConfigured()) {
    try {
      await insertSupabaseSession(token, user)
    } catch (error) {
      console.warn(`Supabase session insert failed: ${error.message}`)
      return json(res, 502, { error: `Supabase session insert failed: ${error.message}` })
    }
  } else sessions.set(token, { email, createdAt: new Date().toISOString() })
  return json(res, 201, { token, user: publicUser(user) })
})

server.post("/api/auth/login", async (req, res) => {
  const email = normalizeEmail(req.body.email)
  const password = String(req.body.password || "")
  const user = await getStoredUserByEmail(email)

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return json(res, 401, { error: "Invalid email or password." })
  }

  const token = crypto.randomUUID()
  if (isSupabaseConfigured()) {
    try {
      await insertSupabaseSession(token, user)
    } catch (error) {
      console.warn(`Supabase session insert failed: ${error.message}`)
      return json(res, 502, { error: `Supabase session insert failed: ${error.message}` })
    }
  } else sessions.set(token, { email, createdAt: new Date().toISOString() })
  return json(res, 200, { token, user: publicUser(user) })
})

server.post("/api/auth/logout", requireAuth, async (req, res) => {
  if (isSupabaseConfigured()) {
    try {
      await deleteSupabaseSession(req.token)
    } catch (error) {
      console.warn(`Supabase session delete failed: ${error.message}`)
    }
  }
  sessions.delete(req.token)
  return json(res, 200, { ok: true })
})

server.get("/api/me", requireAuth, (req, res) => {
  return json(res, 200, { user: publicUser(req.user) })
})

server.get("/api/reports", requireAuth, async (req, res) => {
  let userReports = reports.filter((report) => report.userId === req.user.id)
  if (isSupabaseConfigured()) {
    try {
      userReports = await listSupabaseReportsForUser(req.user.id)
    } catch (error) {
      console.warn(`Supabase report list failed, using local fallback: ${error.message}`)
    }
  }
  return json(res, 200, { reports: userReports })
})



server.post("/api/video/link-extract", async (req, res) => {
  const { url = "" } = req.body || {}
  if (!url) return json(res, 400, { error: "Video URL is required." })
  try {
    const extraction = await extractVideoLinkContext({ url })
    return json(res, 200, extraction)
  } catch (error) {
    return json(res, 502, { error: publicErrorMessage(error, "Video link extraction failed.") })
  }
})
server.post("/api/video/extract", async (req, res) => {
  const { fileName = "video", mimeType = "video/mp4", data = "" } = req.body || {}
  if (!data) return json(res, 400, { error: "Video data is required." })
  try {
    const extraction = await extractVideoTextWithGemini({ fileName, mimeType, data })
    return json(res, 200, extraction)
  } catch (error) {
    return json(res, 502, { error: publicErrorMessage(error, "Video extraction failed.") })
  }
})
server.post("/api/verify", async (req, res) => {
  try {
    const result = await createVerificationResult(req.body)
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, "")
    const session = token ? sessions.get(token) : null
    const user = session ? users.get(session.email) : null

    const report = {
      id: crypto.randomUUID(),
      userId: user?.id || null,
      inputType: result.inputType,
      language: result.language,
      createdAt: new Date().toISOString(),
      result,
    }
    reports.unshift(report)
    if (isSupabaseConfigured()) {
      try {
        await insertSupabaseReport(report)
      } catch (error) {
        console.warn(`Supabase report insert failed, kept local fallback: ${error.message}`)
      }
    }
    return json(res, 200, { reportId: report.id, result })
  } catch (error) {
    console.error(`Verification failed: ${error.message}`)
    return json(res, 502, { error: publicErrorMessage(error, "Verification failed.") })
  }
})

server.all(/^\/api\/.*/, (req, res) => {
  return json(res, 404, { error: "API route not found." })
})

server.all(/.*/, (req, res) => handle(req, res))

server.listen(port, () => {
  console.log(`Factra backend ready at http://127.0.0.1:${port}`)
})

