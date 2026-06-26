const env = (name) => process.env[name]?.trim() || ""
const SUPABASE_TIMEOUT_MS = 6000

export function getSupabaseConfig() {
  return {
    url: env("SUPABASE_URL"),
    serviceKey: env("SUPABASE_SERVICE_ROLE_KEY"),
    anonKey: env("SUPABASE_ANON_KEY") || env("SUPABASE_PUBLISHABLE_KEY"),
    publishableKey: env("SUPABASE_PUBLISHABLE_KEY"),
  }
}

function getRestKey(config = getSupabaseConfig()) {
  return config.serviceKey || config.anonKey || config.publishableKey
}

export function isSupabaseConfigured() {
  const config = getSupabaseConfig()
  return Boolean(config.url && getRestKey(config))
}

export function isUsingSupabaseServiceRole() {
  return Boolean(getSupabaseConfig().serviceKey)
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), SUPABASE_TIMEOUT_MS)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

function parseSupabaseError(data, fallback) {
  return data?.msg || data?.message || data?.error_description || data?.error || fallback
}

async function supabaseFetch(path, options = {}) {
  const config = getSupabaseConfig()
  const key = getRestKey(config)
  if (!config.url || !key) throw new Error("Supabase is not configured")

  const response = await fetchWithTimeout(`${config.url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {}),
    },
  })

  const text = await response.text()
  const data = text ? JSON.parse(text) : null
  if (!response.ok) throw new Error(parseSupabaseError(data, `Supabase request failed: ${response.status}`))
  return data
}

async function supabaseAuthFetch(path, options = {}) {
  const config = getSupabaseConfig()
  if (!config.url || !config.serviceKey) throw new Error("Supabase service role key is required for Auth Admin")

  const response = await fetchWithTimeout(`${config.url}/auth/v1/${path}`, {
    ...options,
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  })

  const text = await response.text()
  const data = text ? JSON.parse(text) : null
  if (!response.ok) throw new Error(parseSupabaseError(data, `Supabase Auth request failed: ${response.status}`))
  return data
}

export async function checkSupabaseConnection() {
  const config = getSupabaseConfig()
  if (!config.url) return { configured: false, ok: false, error: "SUPABASE_URL is missing" }
  if (!getRestKey(config)) return { configured: false, ok: false, error: "Supabase API key is missing" }

  try {
    const rows = await supabaseFetch("app_users?select=id&limit=1")
    return {
      configured: true,
      ok: true,
      host: new URL(config.url).host,
      serviceRole: Boolean(config.serviceKey),
      appUsersReadable: Array.isArray(rows),
    }
  } catch (error) {
    return {
      configured: true,
      ok: false,
      host: (() => { try { return new URL(config.url).host } catch { return "invalid-url" } })(),
      serviceRole: Boolean(config.serviceKey),
      error: error.name === "AbortError" ? "Supabase request timed out" : error.message,
      cause: error.cause?.code || error.cause?.message || "",
    }
  }
}

export async function createAuthUser(user, password) {
  if (!getSupabaseConfig().serviceKey) return null
  const data = await supabaseAuthFetch("admin/users", {
    method: "POST",
    body: JSON.stringify({
      id: user.id,
      email: user.email,
      password,
      email_confirm: true,
      user_metadata: { name: user.name },
      app_metadata: { provider: "email", providers: ["email"] },
    }),
  })
  return data?.user || data || null
}

export async function findUserByEmail(email) {
  const query = new URLSearchParams({ email: `eq.${email}`, select: "*", limit: "1" })
  const rows = await supabaseFetch(`app_users?${query}`)
  return rows?.[0] || null
}

export async function insertUser(user) {
  const rows = await supabaseFetch("app_users", {
    method: "POST",
    body: JSON.stringify({
      id: user.id,
      name: user.name,
      email: user.email,
      password_hash: user.passwordHash,
      created_at: user.createdAt,
    }),
  })
  return rows?.[0] || null
}

export async function insertSession(token, user) {
  await supabaseFetch("app_sessions", {
    method: "POST",
    body: JSON.stringify({ token, user_id: user.id, email: user.email }),
  })
}

export async function deleteSession(token) {
  await supabaseFetch(`app_sessions?token=eq.${encodeURIComponent(token)}`, { method: "DELETE" })
}

export async function findSession(token) {
  const query = new URLSearchParams({ token: `eq.${token}`, select: "*,app_users(*)", limit: "1" })
  const rows = await supabaseFetch(`app_sessions?${query}`)
  const session = rows?.[0]
  if (!session) return null
  return {
    email: session.email,
    user: session.app_users
      ? {
          id: session.app_users.id,
          name: session.app_users.name,
          email: session.app_users.email,
          passwordHash: session.app_users.password_hash,
          createdAt: session.app_users.created_at,
        }
      : null,
  }
}

export async function insertReport(report) {
  const rows = await supabaseFetch("verification_reports", {
    method: "POST",
    body: JSON.stringify({
      id: report.id,
      user_id: report.userId,
      input_type: report.inputType,
      language: report.language,
      claim: report.result.claim,
      verdict: report.result.verdict,
      trust_score: report.result.trustScore,
      result: report.result,
      created_at: report.createdAt,
    }),
  })
  return rows?.[0] || null
}

export async function listReportsForUser(userId) {
  const query = new URLSearchParams({ user_id: `eq.${userId}`, select: "*", order: "created_at.desc" })
  const rows = await supabaseFetch(`verification_reports?${query}`)
  return (rows || []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    inputType: row.input_type,
    language: row.language,
    createdAt: row.created_at,
    result: row.result,
  }))
}