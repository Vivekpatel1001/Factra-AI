const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:4000"
const TOKEN_KEY = "factra-session-active"

export function getAuthToken() {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function setAuthToken(token) {
  if (token) sessionStorage.setItem(TOKEN_KEY, "1")
  else sessionStorage.removeItem(TOKEN_KEY)
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || "Request failed.")
  return data
}

export async function verifyContent(payload) {
  return request("/api/verify", {
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
