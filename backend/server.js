import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import express from "express"
import cors from "cors"
import helmet from "helmet"
import rateLimit from "express-rate-limit"
import { z } from "zod"
import next from "next"
import { createVerificationResult, extractImageTextWithGemini, extractVideoLinkContext, extractVideoTextWithGemini, relocalizeVerificationResult } from "./services/verification.js"
import {
  checkSupabaseConnection,
  createAuthUser as createSupabaseAuthUser,
  deleteSession as deleteSupabaseSession,
  deleteReportForUser as deleteSupabaseReportForUser,
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
for (const key of Object.keys(process.env)) {
  if (/^VITE_.*(KEY|SECRET|TOKEN|SERVICE_ROLE)/i.test(key)) {
    console.warn(`Security warning: ${key} is frontend-exposed by convention. Move this secret to a backend-only env var.`)
  }
}
const dev = process.env.NODE_ENV !== "production"
const port = Number(process.env.BACKEND_PORT || 4000)
const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://127.0.0.1:5173"
const backendDir = fileURLToPath(new URL(".", import.meta.url))
const app = next({ dev, dir: backendDir })
const handle = app.getRequestHandler()

const users = new Map()
const sessions = new Map()
const reports = []
const SESSION_COOKIE = "factra_session"
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7
const MAX_TEXT_LENGTH = 12000
const MAX_LINK_LENGTH = 2048
const MAX_VIDEO_BYTES = 24 * 1024 * 1024
const SAFE_VIDEO_MIME_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime", "video/x-matroska", "audio/mpeg", "audio/wav", "audio/webm", "audio/mp4"])

const json = (res, status, body) => res.status(status).json(body)
const audit = (event, details = {}) => {
  const safeDetails = Object.fromEntries(Object.entries(details).filter(([key]) => !/password|token|key|secret/i.test(key)))
  console.info(JSON.stringify({ type: "audit", event, at: new Date().toISOString(), ...safeDetails }))
}
const hashSessionToken = (token) => crypto.createHash("sha256").update(String(token)).digest("hex")
const sessionExpiry = () => new Date(Date.now() + SESSION_TTL_MS).toISOString()
const isExpired = (iso) => iso && new Date(iso).getTime() <= Date.now()
const parseCookies = (header = "") => Object.fromEntries(String(header).split(";").map((part) => {
  const index = part.indexOf("=")
  if (index === -1) return null
  return [decodeURIComponent(part.slice(0, index).trim()), decodeURIComponent(part.slice(index + 1).trim())]
}).filter(Boolean))
const getRequestToken = (req) => req.headers.authorization?.replace(/^Bearer\s+/i, "") || parseCookies(req.headers.cookie)[SESSION_COOKIE] || ""
const setSessionCookie = (res, token) => {
  const secure = process.env.NODE_ENV === "production"
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: SESSION_TTL_MS,
    path: "/",
  })
}
const clearSessionCookie = (res) => {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" })
}

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

const authSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(6).max(128),
})
const signupSchema = authSchema.extend({
  name: z.string().trim().min(1).max(80),
})
const optionalUrlSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().url().max(MAX_LINK_LENGTH).refine((value) => /^https?:\/\//i.test(value), "Only http/https URLs are allowed.").optional(),
)
const linkSchema = z.string().trim().url().max(MAX_LINK_LENGTH).refine((value) => /^https?:\/\//i.test(value), "Only http/https URLs are allowed.")
const verifySchema = z.object({
  type: z.enum(["text", "link", "image", "video"]).default("text"),
  language: z.string().trim().min(2).max(8).default("en"),
  content: z.object({
    text: z.string().max(MAX_TEXT_LENGTH).optional(),
    transcript: z.string().max(MAX_TEXT_LENGTH).optional(),
    link: optionalUrlSchema,
    videoUrl: optionalUrlSchema,
    fileName: z.string().max(180).optional(),
    keywords: z.array(z.string().trim().max(80)).max(20).optional(),
    ocrConfidence: z.number().min(0).max(100).optional(),
  }).default({}),
})
const videoExtractSchema = z.object({
  fileName: z.string().trim().min(1).max(180).default("video"),
  mimeType: z.string().trim().min(1).max(80).refine((value) => SAFE_VIDEO_MIME_TYPES.has(value), "Unsupported video/audio file type."),
  data: z.string().min(1),
}).superRefine((value, ctx) => {
  const approxBytes = Math.ceil(value.data.length * 0.75)
  if (approxBytes > MAX_VIDEO_BYTES) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["data"], message: "Video/audio file is too large. Maximum size is 24MB." })
  }
})
const imageExtractSchema = z.object({
  fileName: z.string().trim().min(1).max(180).default("image"),
  mimeType: z.string().trim().min(1).max(80).refine((value) => /^image\//.test(value), "Unsupported image file type."),
  data: z.string().min(1),
  language: z.string().trim().min(2).max(8).default("en"),
}).superRefine((value, ctx) => {
  const approxBytes = Math.ceil(value.data.length * 0.75)
  if (approxBytes > 8 * 1024 * 1024) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["data"], message: "Image file is too large. Maximum size is 8MB." })
  }
})
const translateReportSchema = z.object({
  language: z.string().trim().min(2).max(8).default("en"),
  result: z.record(z.any()),
})

const validateBody = (schema) => (req, res, nextMiddleware) => {
  const parsed = schema.safeParse(req.body || {})
  if (!parsed.success) {
    audit("validation_failed", { path: req.path, ip: req.ip })
    return json(res, 400, { error: parsed.error.issues[0]?.message || "Invalid request body." })
  }
  req.validatedBody = parsed.data
  return nextMiddleware()
}

function maskPII(value) {
  if (typeof value === "string") {
    return value
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email]")
      .replace(/\b(?:\+?91[-\s]?)?[6-9]\d{9}\b/g, "[phone]")
      .replace(/\b\d{4}\s?\d{4}\s?\d{4}\b/g, "[id]")
      .replace(/\b\d{6}\b/g, "[pin]")
  }
  if (Array.isArray(value)) return value.map(maskPII)
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, maskPII(item)]))
  return value
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
        const user = {
          id: supabaseUser.id,
          name: supabaseUser.name,
          email: supabaseUser.email,
          passwordHash: supabaseUser.password_hash,
          createdAt: supabaseUser.created_at,
        }
        users.set(email, user)
        return user
      }
    } catch (error) {
      console.warn(`Supabase user lookup failed, using local fallback: ${error.message}`)
    }
  }
  return users.get(email) || null
}

const getUserFromToken = async (token) => {
  if (!token) return null
  const tokenHash = hashSessionToken(token)
  if (isSupabaseConfigured()) {
    try {
      const session = await findSupabaseSession(tokenHash)
      if (session && isExpired(session.expiresAt)) return null
      if (session?.user) return session.user
    } catch (error) {
      console.warn(`Supabase session lookup failed, using local fallback: ${error.message}`)
    }
  }
  const session = sessions.get(tokenHash)
  if (session && isExpired(session.expiresAt)) {
    sessions.delete(tokenHash)
    return null
  }
  return session ? users.get(session.email) : null
}
const requireAuth = async (req, res, nextMiddleware) => {
  const token = getRequestToken(req)
  if (!token) return json(res, 401, { error: "Unauthorized" })
  const tokenHash = hashSessionToken(token)

  if (isSupabaseConfigured()) {
    try {
      const session = await findSupabaseSession(tokenHash)
      if (session && isExpired(session.expiresAt)) return json(res, 401, { error: "Session expired. Please log in again." })
      if (session?.user) {
        req.user = session.user
        req.token = tokenHash
        return nextMiddleware()
      }
    } catch (error) {
      console.warn(`Supabase session lookup failed, using local fallback: ${error.message}`)
    }
  }

  const session = sessions.get(tokenHash)
  if (!session) return json(res, 401, { error: "Unauthorized" })
  if (isExpired(session.expiresAt)) {
    sessions.delete(tokenHash)
    return json(res, 401, { error: "Session expired. Please log in again." })
  }
  let user = users.get(session.email)
  if (!user) {
    user = await getStoredUserByEmail(session.email)
    if (user) users.set(session.email, user)
  }
  if (!user) return json(res, 401, { error: "Unauthorized" })
  
  req.user = user
  req.token = tokenHash
  return nextMiddleware()
}

await app.prepare()

const server = express()

server.set("trust proxy", "loopback")
server.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}))
server.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin === frontendOrigin || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin) || /^http:\/\/localhost:\d+$/.test(origin)) return callback(null, true)
    audit("cors_blocked", { origin })
    return callback(new Error("CORS origin is not allowed"))
  },
  credentials: true,
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}))
server.use(express.json({ limit: "26mb", strict: true }))

const rateLimitJsonHandler = (message) => (req, res) => {
  audit("rate_limited", { path: req.path, ip: req.ip })
  return json(res, 429, { error: message })
}
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT || 50),
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitJsonHandler("Too many login/signup attempts. Please wait a few minutes and try again."),
})
const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitJsonHandler("Too many verification requests. Please wait a few minutes and try again."),
})
const videoLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitJsonHandler("Too many video extraction requests. Please wait and try again."),
})
const reportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitJsonHandler("Too many report requests. Please wait a few minutes and try again."),
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

server.post("/api/auth/signup", authLimiter, validateBody(signupSchema), async (req, res) => {
  const email = normalizeEmail(req.validatedBody.email)
  const name = req.validatedBody.name
  const password = req.validatedBody.password

  if (await getStoredUserByEmail(email)) {
    audit("signup_duplicate", { email })
    return json(res, 409, { error: "An account already exists for this email." })
  }

  const user = {
    id: crypto.randomUUID(),
    name,
    email,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  }
  
  users.set(email, user) // Always cache locally

  if (isSupabaseConfigured()) {
    try {
      await insertSupabaseUser(user)
      try {
        await createSupabaseAuthUser(user, password)
      } catch (error) {
        console.warn(`Supabase Auth user creation failed. Custom app_users row was saved: ${error.message}`)
      }
    } catch (error) {
      console.warn(`Supabase user insert failed, using local fallback: ${error.message}`)
    }
  }

  const token = crypto.randomBytes(32).toString("base64url")
  const tokenHash = hashSessionToken(token)
  const expiresAt = sessionExpiry()
  
  sessions.set(tokenHash, { email, createdAt: new Date().toISOString(), expiresAt }) // Always cache locally
  
  if (isSupabaseConfigured()) {
    try {
      await insertSupabaseSession(tokenHash, user, expiresAt)
    } catch (error) {
      console.warn(`Supabase session insert failed, using local fallback: ${error.message}`)
    }
  }
  setSessionCookie(res, token)
  audit("signup_success", { userId: user.id, email })
  return json(res, 201, { token, user: publicUser(user) })
})

server.post("/api/auth/login", authLimiter, validateBody(authSchema), async (req, res) => {
  const email = normalizeEmail(req.validatedBody.email)
  const password = req.validatedBody.password
  const user = await getStoredUserByEmail(email)

  if (!user || !verifyPassword(password, user.passwordHash)) {
    audit("login_failed", { email })
    return json(res, 401, { error: "Invalid email or password." })
  }
  
  users.set(email, user) // Always cache locally

  const token = crypto.randomBytes(32).toString("base64url")
  const tokenHash = hashSessionToken(token)
  const expiresAt = sessionExpiry()
  
  sessions.set(tokenHash, { email, createdAt: new Date().toISOString(), expiresAt }) // Always cache locally
  
  if (isSupabaseConfigured()) {
    try {
      await insertSupabaseSession(tokenHash, user, expiresAt)
    } catch (error) {
      console.warn(`Supabase session insert failed, using local fallback: ${error.message}`)
    }
  }
  setSessionCookie(res, token)
  audit("login_success", { userId: user.id, email })
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
  clearSessionCookie(res)
  audit("logout", { userId: req.user?.id })
  return json(res, 200, { ok: true })
})

server.get("/api/me", requireAuth, (req, res) => {
  return json(res, 200, { user: publicUser(req.user) })
})

server.get("/api/reports", reportLimiter, requireAuth, async (req, res) => {
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

server.delete("/api/reports/:id", reportLimiter, requireAuth, async (req, res) => {
  const reportId = String(req.params.id || "")
  if (!/^[0-9a-f-]{36}$/i.test(reportId)) return json(res, 400, { error: "Invalid report id." })
  const index = reports.findIndex((report) => report.id === reportId && report.userId === req.user.id)
  if (index !== -1) reports.splice(index, 1)
  if (isSupabaseConfigured()) {
    try {
      await deleteSupabaseReportForUser(reportId, req.user.id)
    } catch (error) {
      console.warn(`Supabase report delete failed: ${error.message}`)
    }
  }
  audit("report_deleted", { reportId, userId: req.user.id })
  return json(res, 200, { ok: true })
})



server.post("/api/image/extract", videoLimiter, validateBody(imageExtractSchema), async (req, res) => {
  const { fileName, mimeType, data, language } = req.validatedBody
  try {
    const extraction = await extractImageTextWithGemini({ fileName, mimeType, data, language })
    audit("image_extracted", { mimeType, approxBytes: Math.ceil(data.length * 0.75) })
    return json(res, 200, extraction)
  } catch (error) {
    audit("api_key_or_image_extract_failure", { path: req.path })
    return json(res, 502, { error: publicErrorMessage(error, "Image text extraction failed.") })
  }
})

server.post("/api/video/link-extract", videoLimiter, validateBody(videoLinkSchema), async (req, res) => {
  const { url } = req.validatedBody
  try {
    const extraction = await extractVideoLinkContext({ url })
    audit("video_link_extracted", { host: new URL(url).host })
    return json(res, 200, extraction)
  } catch (error) {
    audit("api_key_or_video_link_failure", { path: req.path })
    return json(res, 502, { error: publicErrorMessage(error, "Video link extraction failed.") })
  }
})
server.post("/api/video/extract", videoLimiter, validateBody(videoExtractSchema), async (req, res) => {
  const { fileName, mimeType, data } = req.validatedBody
  try {
    const extraction = await extractVideoTextWithGemini({ fileName, mimeType, data })
    audit("video_extracted", { mimeType, approxBytes: Math.ceil(data.length * 0.75) })
    return json(res, 200, extraction)
  } catch (error) {
    audit("api_key_or_video_extract_failure", { path: req.path })
    return json(res, 502, { error: publicErrorMessage(error, "Video extraction failed.") })
  }
})
server.post("/api/verify", verifyLimiter, validateBody(verifySchema), async (req, res) => {
  try {
    const result = await createVerificationResult(req.validatedBody)
    const token = getRequestToken(req)
    const user = token ? await getUserFromToken(token) : null

    const report = {
      id: crypto.randomUUID(),
      userId: user?.id || null,
      inputType: result.inputType,
      language: result.language,
      createdAt: new Date().toISOString(),
      result: maskPII(result),
    }
    reports.unshift(report)
    if (isSupabaseConfigured()) {
      try {
        await insertSupabaseReport(report)
      } catch (error) {
        console.warn(`Supabase report insert failed, kept local fallback: ${error.message}`)
      }
    }
    audit("report_generated", { reportId: report.id, userId: user?.id || null, inputType: result.inputType, verdict: result.verdict })
    return json(res, 200, { reportId: report.id, result })
  } catch (error) {
    console.error(`Verification failed: ${error.message}`)
    audit("verification_failed", { path: req.path })
    return json(res, 502, { error: publicErrorMessage(error, "Verification failed.") })
  }
})
server.post("/api/translate-report", verifyLimiter, validateBody(translateReportSchema), async (req, res) => {
  try {
    const { result, language } = req.validatedBody
    const localized = await relocalizeVerificationResult(result, language)
    return json(res, 200, { result: localized })
  } catch (error) {
    console.error(`Report translation failed: ${error.message}`)
    return json(res, 502, { error: publicErrorMessage(error, "Report translation failed.") })
  }
})

server.use("/api", (error, req, res, nextMiddleware) => {
  if (!error) return nextMiddleware()
  audit("suspicious_or_invalid_request", { path: req.path, ip: req.ip })
  if (error.type === "entity.too.large") return json(res, 413, { error: "Request payload is too large." })
  if (/CORS/i.test(error.message || "")) return json(res, 403, { error: "Origin is not allowed." })
  return json(res, 400, { error: "Invalid request." })
})

server.all(/^\/api\/.*/, (req, res) => {
  return json(res, 404, { error: "API route not found." })
})

server.all(/.*/, (req, res) => handle(req, res))

server.listen(port, () => {
  console.log(`Factra backend ready at http://127.0.0.1:${port}`)
})

