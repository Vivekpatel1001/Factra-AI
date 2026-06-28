const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:4000"
const TOKEN_KEY = "factra-session-token"
let unauthorizedHandler = null

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler
}

export function getAuthToken() {
  const token = sessionStorage.getItem(TOKEN_KEY)
  if (!token || token === "1" || token === "cookie") return ""
  return token
}

export function setAuthToken(token) {
  if (token && token !== "cookie") sessionStorage.setItem(TOKEN_KEY, token)
  else sessionStorage.removeItem(TOKEN_KEY)
}

async function request(path, options = {}) {
  const token = getAuthToken()
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  const text = await response.text()
  let data = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { error: text }
  }
  if (response.status === 401) {
    setAuthToken(null)
    unauthorizedHandler?.()
  }
  if (!response.ok) throw new Error(data.error || data.message || `Request failed with status ${response.status}.`)
  return data
}

export async function verifyContent(payload) {
  return request("/api/verify", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function translateReportResult(payload) {
  return request("/api/translate-report", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function signup(payload) {
  const data = await request("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  setAuthToken(data.token)
  return data
}

export async function login(payload) {
  const data = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  setAuthToken(data.token)
  return data
}

export async function getMe() {
  return request("/api/me")
}

export async function logout() {
  try {
    return await request("/api/auth/logout", { method: "POST" })
  } finally {
    setAuthToken(null)
  }
}
export async function extractImageContent(payload) {
  return request("/api/image/extract", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}


export async function extractVideoContent(payload) {
  return request("/api/video/extract", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}


export async function extractVideoLinkContent(payload) {
  return request("/api/video/link-extract", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}
export async function getReports() {
  return request("/api/reports")
}

export async function deleteReport(reportId) {
  return request(`/api/reports/${encodeURIComponent(reportId)}`, { method: "DELETE" })
}
