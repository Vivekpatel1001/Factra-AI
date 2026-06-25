import crypto from "node:crypto"
import { fileURLToPath } from "node:url"
import express from "express"
import next from "next"
import { createVerificationResult } from "./services/verification.js"

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

const requireAuth = (req, res, nextMiddleware) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "")
  const session = token ? sessions.get(token) : null
  if (!session) return json(res, 401, { error: "Unauthorized" })
  req.user = users.get(session.email)
  req.token = token
  return nextMiddleware()
}

await app.prepare()

const server = express()

server.use(express.json({ limit: "1mb" }))
server.use((req, res, nextMiddleware) => {
  res.setHeader("Access-Control-Allow-Origin", frontendOrigin)
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  if (req.method === "OPTIONS") return res.sendStatus(204)
  return nextMiddleware()
})

server.get("/api/health", (req, res) => {
  json(res, 200, {
    ok: true,
    service: "Factra AI backend",
    technologies: ["Next.js", "Express.js"],
    timestamp: new Date().toISOString(),
  })
})

server.post("/api/auth/signup", (req, res) => {
  const email = normalizeEmail(req.body.email)
  const name = String(req.body.name || "").trim()
  const password = String(req.body.password || "")

  if (!name || !email || password.length < 6) {
    return json(res, 400, { error: "Name, valid email, and 6+ character password are required." })
  }
  if (users.has(email)) {
    return json(res, 409, { error: "An account already exists for this email." })
  }

  const user = {
    id: crypto.randomUUID(),
    name,
    email,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  }
  users.set(email, user)

  const token = crypto.randomUUID()
  sessions.set(token, { email, createdAt: new Date().toISOString() })
  return json(res, 201, { token, user: publicUser(user) })
})

server.post("/api/auth/login", (req, res) => {
  const email = normalizeEmail(req.body.email)
  const password = String(req.body.password || "")
  const user = users.get(email)

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return json(res, 401, { error: "Invalid email or password." })
  }

  const token = crypto.randomUUID()
  sessions.set(token, { email, createdAt: new Date().toISOString() })
  return json(res, 200, { token, user: publicUser(user) })
})

server.post("/api/auth/logout", requireAuth, (req, res) => {
  sessions.delete(req.token)
  return json(res, 200, { ok: true })
})

server.get("/api/me", requireAuth, (req, res) => {
  return json(res, 200, { user: publicUser(req.user) })
})

server.get("/api/reports", requireAuth, (req, res) => {
  const userReports = reports.filter((report) => report.userId === req.user.id)
  return json(res, 200, { reports: userReports })
})

server.post("/api/verify", (req, res) => {
  const result = createVerificationResult(req.body)
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
  return json(res, 200, { reportId: report.id, result })
})

server.all(/^\/api\/.*/, (req, res) => {
  return json(res, 404, { error: "API route not found." })
})

server.all(/.*/, (req, res) => handle(req, res))

server.listen(port, () => {
  console.log(`Factra backend ready at http://127.0.0.1:${port}`)
})
