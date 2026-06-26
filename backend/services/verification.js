import { GoogleGenAI } from "@google/genai"
import { translations } from "../../src/lib/translations.js"

const MAX_EVIDENCE_ITEMS = 8
const VECTOR_SIZE = 384
const SEARCH_TIMEOUT_MS = 9000

const evidence = (source, explanation, link = "#", trusted = false) => ({
  source,
  explanation,
  link,
  trusted,
})

const read = (language, key) => {
  const dict = translations[language] || translations.en
  return dict[key] || translations.en[key] || key
}

const env = (name) => process.env[name]?.trim() || ""

function cleanClaim(payload = {}) {
  const content = payload.content || {}
  return String(content.text || content.transcript || content.videoUrl || content.link || content.fileName || "")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeVerdict(value) {
  const verdict = String(value || "UNVERIFIED").toUpperCase()
  if (["TRUE", "FALSE", "MISLEADING", "UNVERIFIED"].includes(verdict)) return verdict
  return "UNVERIFIED"
}

function clampScore(value, fallback = 45) {
  const score = Number(value)
  if (!Number.isFinite(score)) return fallback
  return Math.max(0, Math.min(100, Math.round(score)))
}

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097f\u0a80-\u0aff]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2)
}

function hashToken(token) {
  let hash = 2166136261
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash) % VECTOR_SIZE
}

function embedText(text) {
  const vector = new Float32Array(VECTOR_SIZE)
  for (const token of tokenize(text)) vector[hashToken(token)] += 1
  let norm = 0
  for (const value of vector) norm += value * value
  norm = Math.sqrt(norm) || 1
  for (let i = 0; i < vector.length; i += 1) vector[i] /= norm
  return vector
}

function cosine(a, b) {
  let total = 0
  for (let i = 0; i < a.length; i += 1) total += a[i] * b[i]
  return total
}

function vectorRankEvidence(claim, items) {
  const claimVector = embedText(claim)
  return items
    .map((item) => ({
      ...item,
      similarity: cosine(claimVector, embedText(`${item.source} ${item.explanation}`)),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, MAX_EVIDENCE_ITEMS)
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
    return await response.json()
  } finally {
    clearTimeout(timeout)
  }
}

async function searchSerper(claim) {
  const key = env("SERPER_API_KEY")
  if (!key) return []

  const data = await fetchJson("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": key,
    },
    body: JSON.stringify({ q: claim, gl: "in", hl: "en", num: 8 }),
  })

  return [...(data.organic || []), ...(data.news || [])].slice(0, 8).map((item) =>
    evidence(
      item.title || item.source || "Serper result",
      item.snippet || item.description || item.title || "Search result matched the claim.",
      item.link || "#",
      true,
    ),
  )
}

async function searchNewsApi(claim) {
  const key = env("NEWSAPI_KEY")
  if (!key) return []

  const url = new URL("https://newsapi.org/v2/everything")
  url.searchParams.set("q", claim)
  url.searchParams.set("language", "en")
  url.searchParams.set("sortBy", "relevancy")
  url.searchParams.set("pageSize", "6")
  url.searchParams.set("apiKey", key)

  const data = await fetchJson(url)
  return (data.articles || []).map((item) =>
    evidence(
      item.source?.name || item.title || "NewsAPI result",
      item.description || item.title || "News article matched the claim.",
      item.url || "#",
      true,
    ),
  )
}

async function searchNewsData(claim) {
  const key = env("NEWSDATA_API_KEY")
  if (!key) return []

  const url = new URL("https://newsdata.io/api/1/latest")
  url.searchParams.set("apikey", key)
  url.searchParams.set("q", claim)
  url.searchParams.set("language", "en")
  url.searchParams.set("country", "in")

  const data = await fetchJson(url)
  return (data.results || []).slice(0, 6).map((item) =>
    evidence(
      item.source_name || item.title || "NewsData result",
      item.description || item.title || "News result matched the claim.",
      item.link || "#",
      true,
    ),
  )
}

async function collectEvidence(claim) {
  const searches = await Promise.allSettled([
    searchSerper(claim),
    searchNewsApi(claim),
    searchNewsData(claim),
  ])

  const searchErrors = searches
    .filter((result) => result.status === "rejected")
    .map((result) => result.reason?.message || "Search failed")

  const byLink = new Map()
  for (const result of searches) {
    if (result.status !== "fulfilled") continue
    for (const item of result.value) {
      const key = item.link && item.link !== "#" ? item.link : `${item.source}:${item.explanation}`
      if (!byLink.has(key)) byLink.set(key, item)
    }
  }

  const ranked = vectorRankEvidence(claim, [...byLink.values()])
  if (ranked.length) return { evidenceItems: ranked, searchErrors }

  return {
    evidenceItems: [
      evidence("No strong live evidence found", "The configured search providers did not return a clear matching source for this claim.", "#"),
    ],
    searchErrors,
  }
}

function parseJsonFromText(text) {
  const trimmed = String(text || "").trim()
  const direct = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1] || trimmed
  const objectText = direct.match(/\{[\s\S]*\}/)?.[0] || direct
  return JSON.parse(objectText)
}

function fallbackAnalysis(claim, evidenceItems, searchErrors = []) {
  const joined = evidenceItems.map((item) => `${item.source} ${item.explanation}`).join(" ").toLowerCase()
  const foundNoConfirmation = /no strong live evidence|did not return|not found|no such|false|scam/.test(joined)
  const verdict = foundNoConfirmation ? "UNVERIFIED" : "MISLEADING"

  return {
    verdict,
    trustScore: foundNoConfirmation ? 35 : 55,
    meaning: foundNoConfirmation
      ? "The live sources did not give enough reliable proof to confirm this claim. Treat it as unverified until an official or trusted source confirms it."
      : "The available sources do not fully support the claim, so it may be incomplete or misleading.",
    recommendation: "Do not share or act on this claim until you verify it from an official source.",
    modelUsed: "fallback-rules",
    searchErrors,
  }
}

async function analyzeWithGemini(claim, evidenceItems) {
  const key = env("GEMINI_API_KEY") || env("GOOGLE_API_KEY")
  if (!key) throw new Error("Gemini API key is missing")

  const ai = new GoogleGenAI({ apiKey: key })
  const evidenceText = evidenceItems
    .map((item, index) => `[${index + 1}] ${item.source}\n${item.explanation}\n${item.link}`)
    .join("\n\n")

  const prompt = `You are a careful fact-checking assistant.\n\nClaim:\n${claim}\n\nEvidence:\n${evidenceText}\n\nBased only on the evidence above, classify the claim as one of: True, False, Misleading, Unverified.\nReturn only valid JSON with these keys:\n{\n  "verdict": "TRUE | FALSE | MISLEADING | UNVERIFIED",\n  "explanation": "brief user-friendly explanation",\n  "confidenceScore": 0-100,\n  "recommendation": "brief advice for the user"\n}`

  const response = await ai.models.generateContent({
    model: env("GEMINI_MODEL") || "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  })

  const parsed = parseJsonFromText(response.text)
  return {
    verdict: normalizeVerdict(parsed.verdict),
    trustScore: clampScore(parsed.confidenceScore, 50),
    meaning: String(parsed.explanation || "Gemini returned a result without an explanation."),
    recommendation: String(parsed.recommendation || "Review the evidence before sharing."),
    modelUsed: env("GEMINI_MODEL") || "gemini-2.5-flash",
  }
}

function buildVideoTimeline(transcript) {
  const lines = String(transcript || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)

  return lines.slice(0, 8).map((line, index) => {
    const timeMatch = line.match(/\[?(\d{1,2}:\d{2})\]?/)
    const time = timeMatch?.[1] || `00:${String((index + 1) * 12).padStart(2, "0")}`
    const claim = line.replace(/\[?\d{1,2}:\d{2}\]?\s*/, "")
    return { time, claim, result: "UNVERIFIED" }
  })
}

export async function createVerificationResult(payload = {}) {
  const inputType = ["text", "link", "image", "video"].includes(payload.type) ? payload.type : "text"
  const language = translations[payload.language] ? payload.language : "en"
  const t = (key) => read(language, key)
  const claim = cleanClaim(payload) || t("mock_text_claim")

  const { evidenceItems, searchErrors } = await collectEvidence(claim)
  let analysis
  try {
    analysis = await analyzeWithGemini(claim, evidenceItems)
  } catch (error) {
    analysis = fallbackAnalysis(claim, evidenceItems, [...searchErrors, error.message])
  }

  return {
    inputType,
    language,
    verdict: analysis.verdict,
    trustScore: analysis.trustScore,
    claim,
    meaning: analysis.meaning,
    evidence: evidenceItems,
    recommendation: analysis.recommendation,
    transcript: payload.content?.transcript || "",
    timeline: inputType === "video" ? buildVideoTimeline(payload.content?.transcript || claim) : undefined,
    retrieval: {
      engine: "Serper + NewsAPI + NewsData + local vector ranking",
      vectorIndex: "In-memory hashed embedding index for RAG-style evidence ranking",
      model: analysis.modelUsed,
      searchErrors: analysis.searchErrors || searchErrors,
    },
  }
}
export async function extractVideoTextWithGemini({ fileName = "video", mimeType = "video/mp4", data = "" } = {}) {
  const key = env("GEMINI_API_KEY") || env("GOOGLE_API_KEY")
  if (!key) throw new Error("Gemini API key is missing")
  if (!data) throw new Error("Video data is missing")

  const ai = new GoogleGenAI({ apiKey: key })
  const response = await ai.models.generateContent({
    model: env("GEMINI_MODEL") || "gemini-2.5-flash",
    contents: [
      {
        text:
          "Analyze this uploaded video for fact-checking. Extract all visible text from frames and transcribe any spoken words. Return only JSON with keys visibleText, speechTranscript, combinedText, and notes. If there is no speech, speechTranscript should be empty. If there is no visible text, visibleText should be empty.",
      },
      {
        inlineData: {
          mimeType,
          data,
        },
      },
    ],
    config: {
      responseMimeType: "application/json",
      temperature: 0,
    },
  })

  const parsed = parseJsonFromText(response.text)
  const visibleText = String(parsed.visibleText || "").trim()
  const speechTranscript = String(parsed.speechTranscript || "").trim()
  const combinedText = String(parsed.combinedText || [visibleText, speechTranscript].filter(Boolean).join("\n\n")).trim()

  return {
    fileName,
    visibleText,
    speechTranscript,
    combinedText,
    notes: String(parsed.notes || ""),
    model: env("GEMINI_MODEL") || "gemini-2.5-flash",
  }
}
export async function extractVideoLinkContext({ url = "" } = {}) {
  const videoUrl = String(url || "").trim()
  if (!videoUrl) throw new Error("Video URL is required")

  let host = "video link"
  try {
    host = new URL(videoUrl).hostname.replace(/^www\./, "")
  } catch {
    host = "video link"
  }

  const searchQuery = `${videoUrl} video claim fact check OR news OR transcript`
  const searchResults = await searchSerper(searchQuery).catch(() => [])
  const evidenceText = searchResults.length
    ? searchResults.map((item, index) => `[${index + 1}] ${item.source}\n${item.explanation}\n${item.link}`).join("\n\n")
    : "No public search results were found for this video URL."

  let extracted = {
    title: host,
    visibleText: "",
    speechTranscript: "",
    combinedText: `Public video URL: ${videoUrl}`,
    notes: "No public context could be extracted. Ask the user to upload a shorter clip or paste the spoken words.",
    sources: searchResults,
  }

  const key = env("GEMINI_API_KEY") || env("GOOGLE_API_KEY")
  if (!key) return extracted

  try {
    const ai = new GoogleGenAI({ apiKey: key })
    const response = await ai.models.generateContent({
      model: env("GEMINI_MODEL") || "gemini-2.5-flash",
      contents: `You help prepare social video content for fact-checking. Do not claim you watched the video unless the evidence says so. Based only on this public video URL and public search snippets, extract the main checkable claim or context.\n\nVideo URL:\n${videoUrl}\n\nPublic search evidence:\n${evidenceText}\n\nReturn only JSON with keys title, visibleText, speechTranscript, combinedText, notes. combinedText must contain the best checkable claim/context for fact-checking.`,
      config: {
        responseMimeType: "application/json",
        temperature: 0,
      },
    })
    const parsed = parseJsonFromText(response.text)
    extracted = {
      title: String(parsed.title || host),
      visibleText: String(parsed.visibleText || "").trim(),
      speechTranscript: String(parsed.speechTranscript || "").trim(),
      combinedText: String(parsed.combinedText || `Public video URL: ${videoUrl}`).trim(),
      notes: String(parsed.notes || ""),
      sources: searchResults,
      model: env("GEMINI_MODEL") || "gemini-2.5-flash",
    }
  } catch (error) {
    extracted.notes = `Could not summarize public context with Gemini: ${error.message}`
  }

  return extracted
}
