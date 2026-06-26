import { GoogleGenAI } from "@google/genai"
import { spawn } from "node:child_process"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { translations } from "../../src/lib/translations.js"

const MAX_EVIDENCE_ITEMS = 8
const VECTOR_SIZE = 768
const SEARCH_TIMEOUT_MS = 9000
const NVIDIA_CHAT_COMPLETIONS_URL = "https://integrate.api.nvidia.com/v1/chat/completions"
const TRUSTED_SOURCE_PATTERNS = [
  /(^|\.)gov\.in$/i,
  /(^|\.)nic\.in$/i,
  /(^|\.)pib\.gov\.in$/i,
  /(^|\.)who\.int$/i,
  /(^|\.)un\.org$/i,
  /(^|\.)reuters\.com$/i,
  /(^|\.)apnews\.com$/i,
  /(^|\.)bbc\.com$/i,
  /(^|\.)thehindu\.com$/i,
  /(^|\.)indianexpress\.com$/i,
  /(^|\.)ndtv\.com$/i,
]

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
function userSafeServiceMessage(error, fallback = "External AI service is unavailable.") {
  const message = String(error?.message || error || "")
  if (/RESOURCE_EXHAUSTED|quota|rate limit|GenerateRequestsPerDay|GenerateRequestsPerMinute|429/i.test(message)) {
    return "Gemini quota is exhausted. Used conservative local fallback instead."
  }
  if (/ENOTFOUND|fetch failed|network|timed out|AbortError/i.test(message)) {
    return "External service is temporarily unreachable. Used conservative local fallback instead."
  }
  return message && message.length < 220 ? message : fallback
}

function cleanClaim(payload = {}) {
  const content = payload.content || {}
  return String(content.text || content.transcript || content.videoUrl || content.link || content.fileName || "")
    .replace(/\s+/g, " ")
    .trim()
}
function compactSearchQuery(payload = {}, claim = "") {
  const content = payload.content || {}
  const keywords = Array.isArray(content.keywords) ? content.keywords.filter(Boolean).slice(0, 12) : []
  if (keywords.length >= 3) return keywords.join(" ")

  const tokens = tokenize(claim)
  const counts = new Map()
  for (const token of tokens) counts.set(token, (counts.get(token) || 0) + 1)
  const ranked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, 14)
    .map(([token]) => token)
  const query = ranked.join(" ").trim()
  return query || String(claim || "").slice(0, 220)
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

async function fetchText(url, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "User-Agent": "FactraAI/1.0 (+https://factra.local)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        ...(options.headers || {}),
      },
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
    return await response.text()
  } finally {
    clearTimeout(timeout)
  }
}

function decodeHtml(value = "") {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
}

function metaContent(html, pattern) {
  return decodeHtml(html.match(pattern)?.[1] || "")
}

function isGenericPlatformContext(text = "") {
  const value = String(text || "").toLowerCase()
  if (!value.trim()) return true
  return [
    /what\s+is\s+youtube\s+shorts/,
    /youtube\s+shorts\s+is\s+a\s+short-form/,
    /enjoy\s+the\s+videos\s+and\s+music\s+you\s+love/,
    /instagram\s+reels\s+is/,
    /facebook\s+reels\s+is/,
    /tiktok\s+is\s+the\s+leading\s+destination/,
    /^https?:\/\//,
  ].some((pattern) => pattern.test(value))
}

async function fetchPageMetadata(url) {
  const metadata = { title: "", description: "", siteName: "", source: "page" }
  try {
    const html = await fetchText(url)
    metadata.title =
      metaContent(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
      metaContent(html, /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i) ||
      metaContent(html, /<title[^>]*>([\s\S]*?)<\/title>/i)
    metadata.description =
      metaContent(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
      metaContent(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
      metaContent(html, /<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']+)["']/i)
    metadata.siteName = metaContent(html, /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)
  } catch {
    // Metadata is best-effort; search snippets can still provide context.
  }
  return metadata
}

async function fetchOembedMetadata(url) {
  const providers = [
    `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
    `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`,
  ]
  for (const provider of providers) {
    try {
      const data = await fetchJson(provider)
      if (data?.title) {
        return {
          title: decodeHtml(data.title),
          description: "",
          siteName: decodeHtml(data.provider_name || ""),
          author: decodeHtml(data.author_name || ""),
          source: "oembed",
        }
      }
    } catch {
      // Try the next oEmbed provider.
    }
  }
  return null
}

async function extractLinkContext({ url = "", kind = "link" } = {}) {
  const linkUrl = String(url || "").trim()
  if (!linkUrl) throw new Error("Link URL is required")

  let host = "link"
  try {
    host = new URL(linkUrl).hostname.replace(/^www\./, "")
  } catch {
    throw new Error("Please enter a valid URL")
  }

  const [pageMetadata, oembedMetadata] = await Promise.all([
    fetchPageMetadata(linkUrl),
    fetchOembedMetadata(linkUrl),
  ])
  const metadata = {
    ...pageMetadata,
    ...(oembedMetadata || {}),
  }
  const metadataText = [
    metadata.title && `Title: ${metadata.title}`,
    metadata.description && `Description: ${metadata.description}`,
    metadata.siteName && `Site: ${metadata.siteName}`,
    metadata.author && `Author: ${metadata.author}`,
  ].filter(Boolean).join("\n")

  const searchQuery = `"${linkUrl}" OR "${metadata.title || host}" claim fact check news`
  const searchResults = await searchSerper(searchQuery).catch(() => [])
  const evidenceText = searchResults.length
    ? searchResults.map((item, index) => `[${index + 1}] ${item.source}\n${item.explanation}\n${item.link}`).join("\n\n")
    : "No public search snippets found for this URL."

  let extracted = {
    title: metadata.title || host,
    visibleText: "",
    speechTranscript: "",
    combinedText: "",
    notes: "No specific factual claim could be extracted from this link. Paste the exact claim or upload the media for a better check.",
    sources: searchResults,
    metadata,
  }

  const localCandidate = [metadata.title, metadata.description]
    .filter((value) => value && !isGenericPlatformContext(value))
    .join("\n")
    .trim()
  if (localCandidate) {
    extracted = {
      ...extracted,
      combinedText: localCandidate,
      notes: "Extracted checkable context from the link metadata. Review it before checking.",
    }
  }

  const key = env("GEMINI_API_KEY") || env("GOOGLE_API_KEY")
  if (!key) return extracted

  const prompt = `You extract factual claims from links for fact-checking.

URL:
${linkUrl}

Metadata:
${metadataText || "No useful metadata."}

Public search snippets:
${evidenceText}

Return only JSON with keys title, visibleText, speechTranscript, combinedText, notes.
combinedText must contain only the actual factual claim or claims made by the linked content.
If the available context is only generic platform information, navigation text, or explains what YouTube Shorts/Reels/TikTok is, set combinedText to an empty string and explain in notes that the exact claim is not available.
Do not invent a claim from the URL.`

  try {
    const ai = new GoogleGenAI({ apiKey: key })
    const response = await ai.models.generateContent({
      model: env("GEMINI_MODEL") || "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0,
      },
    })
    const parsed = parseJsonFromText(response.text)
    const combinedText = String(parsed.combinedText || "").trim()
    extracted = {
      ...extracted,
      title: String(parsed.title || extracted.title || host).trim(),
      visibleText: String(parsed.visibleText || "").trim(),
      speechTranscript: String(parsed.speechTranscript || "").trim(),
      combinedText: isGenericPlatformContext(combinedText) ? "" : combinedText,
      notes: String(parsed.notes || extracted.notes || "").trim(),
      model: env("GEMINI_MODEL") || "gemini-2.5-flash",
    }
  } catch (error) {
    extracted.notes = extracted.combinedText ? extracted.notes : "No specific factual claim could be extracted from this link. Paste the exact claim or upload the media for a better check."
  }

  return extracted
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

async function collectEvidence(claim, searchQuery = claim) {
  const searches = await Promise.allSettled([
    searchSerper(searchQuery),
    searchNewsApi(searchQuery),
    searchNewsData(searchQuery),
  ])

  const searchErrors = searches
    .filter((result) => result.status === "rejected")
    .map((result) => userSafeServiceMessage(result.reason, "Search provider did not respond in time. Used conservative local fallback instead."))

  const byLink = new Map()
  for (const result of searches) {
    if (result.status !== "fulfilled") continue
    for (const item of result.value) {
      const key = item.link && item.link !== "#" ? item.link : `${item.source}:${item.explanation}`
      if (!byLink.has(key)) byLink.set(key, item)
    }
  }

  const ranked = vectorRankEvidence(`${claim} ${searchQuery}`, [...byLink.values()])
    .filter((item) => (item.similarity || 0) >= 0.18 || sourceReliability(item) >= 86)
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
function splitClaimsHeuristic(text, limit = 5) {
  const lines = String(text || "")
    .replace(/\b(Speech transcript|Visible text\s*\/\s*OCR|Notes):/gi, "\n")
    .split(/\n+|(?<=[.!?])\s+/)
    .map((line) => line.replace(/^\[?\d{1,2}:\d{2}\]?\s*/, "").trim())
    .filter((line) => line.length >= 18)

  const seen = new Set()
  return lines.filter((line) => {
    const key = line.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, limit)
}

async function extractClaimsWithAI(text) {
  const prompt = `Extract up to 5 factual, checkable claims from this content. Ignore filler, greetings, and opinions. Preserve timestamps if present. Return only JSON: {"claims":[{"text":"claim","timestamp":"optional MM:SS or empty"}]}\n\nContent:\n${String(text || "").slice(0, 6000)}`
  const key = env("GEMINI_API_KEY") || env("GOOGLE_API_KEY")
  if (key) {
    try {
      const ai = new GoogleGenAI({ apiKey: key })
      const response = await ai.models.generateContent({
        model: env("GEMINI_MODEL") || "gemini-2.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json", temperature: 0 },
      })
      const parsed = parseJsonFromText(response.text)
      const claims = Array.isArray(parsed.claims) ? parsed.claims : []
      return claims.map((claim) => ({ text: String(claim.text || "").trim(), timestamp: String(claim.timestamp || "").trim() })).filter((claim) => claim.text)
    } catch {
      // Fall through to heuristic extraction.
    }
  }
  return splitClaimsHeuristic(text).map((claim) => ({ text: claim, timestamp: "" }))
}

function sourceReliability(item) {
  if (!item?.link || item.link === "#") return item?.trusted ? 55 : 35
  try {
    const host = new URL(item.link).hostname.replace(/^www\./, "")
    if (TRUSTED_SOURCE_PATTERNS.some((pattern) => pattern.test(host))) return 95
    if (/pibfactcheck|factcheck|altnews|snopes|boomlive|logicalindian/i.test(`${host} ${item.source}`)) return 86
    if (/news|times|hindu|reuters|apnews|bbc|ndtv|indianexpress/i.test(host)) return 72
    if (/facebook|instagram|x\.com|twitter|youtube/i.test(host)) return 42
  } catch {
    return item?.trusted ? 55 : 35
  }
  return item?.trusted ? 65 : 50
}

function recencyScore(item) {
  const text = `${item?.source || ""} ${item?.explanation || ""}`
  const year = text.match(/\b(20\d{2})\b/)?.[1]
  if (!year) return 55
  const age = Math.max(0, new Date().getFullYear() - Number(year))
  return Math.max(35, 95 - age * 12)
}

function claimClarityScore(claim) {
  const tokens = tokenize(claim)
  let score = Math.min(95, 35 + tokens.length * 5)
  if (/\b(all|everyone|guaranteed|free|urgent|today|register|claim|official|government)\b/i.test(claim)) score += 8
  if (claim.length > 280) score -= 12
  return clampScore(score, 60)
}

function buildTrustBreakdown(claim, evidenceItems, modelConfidence = 50) {
  const topEvidence = evidenceItems.slice(0, 5)
  const evidenceQuality = clampScore(topEvidence.reduce((sum, item) => sum + sourceReliability(item), 0) / Math.max(1, topEvidence.length), 45)
  const recency = clampScore(topEvidence.reduce((sum, item) => sum + recencyScore(item), 0) / Math.max(1, topEvidence.length), 55)
  const sourceReliabilityScore = evidenceQuality
  const claimClarity = claimClarityScore(claim)
  const confidence = clampScore(modelConfidence, 50)
  const overall = clampScore(evidenceQuality * 0.32 + recency * 0.18 + sourceReliabilityScore * 0.22 + claimClarity * 0.12 + confidence * 0.16, confidence)
  return { evidenceQuality, recency, sourceReliability: sourceReliabilityScore, claimClarity, confidence, overall }
}


function fallbackAnalysis(claim, evidenceItems, searchErrors = []) {
  return {
    verdict: "UNVERIFIED",
    trustScore: 30,
    meaning: "Factra could not verify this claim from strong matching evidence. Treat it as unverified, not true or false, until an official or reliable source confirms it.",
    recommendation: "Do not share or act on this claim yet. Check an official source or correct the extracted text if it came from OCR.",
    modelUsed: "fallback-rules",
    confidence: 30,
    searchErrors,
  }
}
function buildFactCheckPrompt(claim, evidenceItems) {
  const evidenceText = evidenceItems
    .map((item, index) => `[${index + 1}] ${item.source}\n${item.explanation}\n${item.link}`)
    .join("\n\n")

  return `You are a careful fact-checking assistant.\n\nClaim:\n${claim}\n\nEvidence:\n${evidenceText}\n\nBased only on the evidence above, classify the claim as one of: True, False, Misleading, Unverified. If the evidence is not directly about the exact claim, or OCR/transcript text appears unclear, choose UNVERIFIED. Do not infer facts from weak or unrelated evidence.\nReturn only valid JSON with these keys:\n{\n  "verdict": "TRUE | FALSE | MISLEADING | UNVERIFIED",\n  "explanation": "brief user-friendly explanation",\n  "confidenceScore": 0-100,\n  "recommendation": "brief advice for the user"\n}`
}

function isGeminiLimitError(error) {
  const status = Number(error?.status || error?.code || error?.response?.status || 0)
  const message = String(error?.message || error || "").toLowerCase()
  return status === 429 || /quota|rate limit|resource[_ -]?exhausted|too many requests|limit exceeded|exceeded.*limit/.test(message)
}

async function callNvidiaChat({ messages, temperature = 0.1, maxTokens = 1024 }) {
  const key = env("NVIDIA_API_KEY")
  if (!key) throw new Error("NVIDIA API key is missing")

  const response = await fetch(NVIDIA_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: env("NVIDIA_MODEL") || "meta/llama-3.3-70b-instruct",
      messages,
      temperature,
      top_p: 0.7,
      max_tokens: maxTokens,
      stream: false,
    }),
  })

  const text = await response.text()
  if (!response.ok) {
    throw new Error(`NVIDIA API failed: ${response.status} ${response.statusText} ${text.slice(0, 240)}`)
  }

  const data = JSON.parse(text)
  return String(data.choices?.[0]?.message?.content || data.output_text || "")
}

async function analyzeWithNvidia(claim, evidenceItems) {
  const prompt = buildFactCheckPrompt(claim, evidenceItems)
  const text = await callNvidiaChat({
    messages: [
      { role: "system", content: "Return strict JSON only. Do not add markdown or commentary." },
      { role: "user", content: prompt },
    ],
    temperature: 0.1,
    maxTokens: 900,
  })

  const parsed = parseJsonFromText(text)
  return {
    verdict: normalizeVerdict(parsed.verdict),
    trustScore: clampScore(parsed.confidenceScore, 50),
    meaning: String(parsed.explanation || "NVIDIA returned a result without an explanation."),
    recommendation: String(parsed.recommendation || "Review the evidence before sharing."),
    modelUsed: env("NVIDIA_MODEL") || "meta/llama-3.3-70b-instruct",
    confidence: clampScore(parsed.confidenceScore, 50),
  }
}

async function analyzeWithGemini(claim, evidenceItems) {
  const key = env("GEMINI_API_KEY") || env("GOOGLE_API_KEY")
  if (!key) throw new Error("Gemini API key is missing")

  const ai = new GoogleGenAI({ apiKey: key })
  const prompt = buildFactCheckPrompt(claim, evidenceItems)

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
    confidence: clampScore(parsed.confidenceScore, 50),
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

async function analyzeSingleClaim(claimText, payload = {}) {
  const searchQuery = compactSearchQuery({ ...payload, content: { ...(payload.content || {}), text: claimText } }, claimText)
  const { evidenceItems, searchErrors } = await collectEvidence(claimText, searchQuery)
  let analysis
  try {
    analysis = await analyzeWithGemini(claimText, evidenceItems)
  } catch (error) {
    analysis = fallbackAnalysis(claimText, evidenceItems, [...searchErrors, userSafeServiceMessage(error)])
  }

  const trustBreakdown = buildTrustBreakdown(claimText, evidenceItems, analysis.confidence || analysis.trustScore)
  if (analysis.modelUsed === "fallback-rules") {
    trustBreakdown.evidenceQuality = Math.min(trustBreakdown.evidenceQuality, 35)
    trustBreakdown.sourceReliability = Math.min(trustBreakdown.sourceReliability, 35)
    trustBreakdown.confidence = analysis.trustScore
    trustBreakdown.overall = analysis.trustScore
  }
  return {
    claim: claimText,
    verdict: analysis.verdict,
    trustScore: trustBreakdown.overall,
    meaning: analysis.meaning,
    recommendation: analysis.recommendation,
    evidence: evidenceItems,
    searchQuery,
    modelUsed: analysis.modelUsed,
    searchErrors: analysis.searchErrors || searchErrors,
    trustBreakdown,
  }
}

function aggregateVerdict(claimResults = []) {
  const order = { FALSE: 4, MISLEADING: 3, UNVERIFIED: 2, TRUE: 1 }
  return claimResults.map((item) => item.verdict).sort((a, b) => (order[b] || 0) - (order[a] || 0))[0] || "UNVERIFIED"
}

function aggregateTrustBreakdown(claimResults = []) {
  const keys = ["evidenceQuality", "recency", "sourceReliability", "claimClarity", "confidence", "overall"]
  const output = {}
  for (const key of keys) {
    output[key] = clampScore(claimResults.reduce((sum, item) => sum + (item.trustBreakdown?.[key] || 0), 0) / Math.max(1, claimResults.length), 50)
  }
  return output
}

function uniqueEvidence(claimResults = []) {
  const byLink = new Map()
  for (const result of claimResults) {
    for (const item of result.evidence || []) {
      const key = item.link && item.link !== "#" ? item.link : `${item.source}:${item.explanation}`
      if (!byLink.has(key)) byLink.set(key, item)
    }
  }
  return [...byLink.values()].slice(0, MAX_EVIDENCE_ITEMS)
}

function buildClaimTimeline(claims = [], claimResults = []) {
  return claims.slice(0, 8).map((claim, index) => {
    const match = claim.text.match(/\[?(\d{1,2}:\d{2})\]?/)
    const result = claimResults[index]
    return {
      time: claim.timestamp || match?.[1] || `00:${String((index + 1) * 12).padStart(2, "0")}`,
      claim: claim.text.replace(/^\[?\d{1,2}:\d{2}\]?\s*/, ""),
      result: result?.verdict || "UNVERIFIED",
      trustScore: result?.trustScore,
    }
  })
}

export async function createVerificationResult(payload = {}) {
  const inputType = ["text", "link", "image", "video"].includes(payload.type) ? payload.type : "text"
  const language = translations[payload.language] ? payload.language : "en"
  const t = (key) => read(language, key)
  let rawClaim = cleanClaim(payload) || t("mock_text_claim")
  let linkContext = null
  if (inputType === "link" && payload.content?.link) {
    linkContext = await extractLinkContext({ url: payload.content.link, kind: "link" })
    if (!linkContext.combinedText) {
      const note = linkContext.notes || "No specific factual claim could be extracted from this link."
      return {
        inputType,
        language,
        verdict: "UNVERIFIED",
        trustScore: 20,
        trustBreakdown: {
          evidenceQuality: 20,
          recency: 20,
          sourceReliability: 20,
          claimClarity: 15,
          confidence: 20,
          overall: 20,
        },
        claim: payload.content.link,
        claims: [
          {
            id: 1,
            text: "No checkable claim could be extracted from this link.",
            verdict: "UNVERIFIED",
            trustScore: 20,
            meaning: note,
            recommendation: "Paste the exact claim from the page/video, or upload the media file so Factra can read the speech/text directly.",
            evidence: [evidence("No checkable claim extracted", note, payload.content.link)],
            searchQuery: "",
            trustBreakdown: {
              evidenceQuality: 20,
              recency: 20,
              sourceReliability: 20,
              claimClarity: 15,
              confidence: 20,
              overall: 20,
            },
          },
        ],
        meaning: note,
        evidence: [evidence("No checkable claim extracted", note, payload.content.link)],
        recommendation: "Paste the exact claim from the page/video, or upload the media file so Factra can read the speech/text directly.",
        transcript: "",
        linkContext,
        retrieval: {
          engine: "Link metadata + public search snippets",
          query: "",
          vectorIndex: "Skipped because no checkable claim was extracted",
          model: linkContext.model || "metadata",
          searchErrors: [],
        },
      }
    }
    rawClaim = linkContext.combinedText
  }
  const extractedClaims = await extractClaimsWithAI(rawClaim)
  const claims = (extractedClaims.length ? extractedClaims : [{ text: rawClaim, timestamp: "" }]).slice(0, 5)
  const claimResults = []

  for (const claim of claims) {
    claimResults.push(await analyzeSingleClaim(claim.text, payload))
  }

  const primary = claimResults[0]
  const trustBreakdown = aggregateTrustBreakdown(claimResults)
  const verdict = aggregateVerdict(claimResults)
  const evidenceItems = uniqueEvidence(claimResults)
  const searchErrors = claimResults.flatMap((item) => item.searchErrors || [])

  return {
    inputType,
    language,
    verdict,
    trustScore: trustBreakdown.overall,
    trustBreakdown,
    claim: rawClaim,
    claims: claimResults.map((item, index) => ({
      id: index + 1,
      text: item.claim,
      verdict: item.verdict,
      trustScore: item.trustScore,
      meaning: item.meaning,
      recommendation: item.recommendation,
      evidence: item.evidence,
      searchQuery: item.searchQuery,
      trustBreakdown: item.trustBreakdown,
    })),
    meaning: claimResults.length > 1
      ? `${claimResults.length} checkable claims were extracted. The highest-risk claim is ${verdict.toLowerCase()}: ${claimResults.find((item) => item.verdict === verdict)?.meaning || primary.meaning}`
      : primary.meaning,
    evidence: evidenceItems,
    recommendation: primary.recommendation,
    transcript: payload.content?.transcript || "",
    linkContext,
    timeline: inputType === "video" ? buildClaimTimeline(claims, claimResults) : undefined,
    retrieval: {
      engine: "Serper + NewsAPI + NewsData + local vector database ranking",
      query: claimResults.map((item) => item.searchQuery).join(" | "),
      vectorIndex: "Local 768-dimensional vector ranking with FAISS/Chroma-ready embeddings adapter",
      model: [...new Set(claimResults.map((item) => item.modelUsed))].join(" + "),
      searchErrors,
    },
  }
}
function secondsToTimestamp(value = 0) {
  const total = Math.max(0, Math.floor(Number(value) || 0))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, windowsHide: true })
    const timeoutMs = Number(env("WHISPER_TIMEOUT_MS") || 90000)
    let stdout = ""
    let stderr = ""
    const timeout = setTimeout(() => {
      child.kill("SIGKILL")
      reject(new Error(`Whisper transcription timed out after ${Math.round(timeoutMs / 1000)} seconds`))
    }, timeoutMs)
    child.stdout?.on("data", (chunk) => { stdout += chunk.toString() })
    child.stderr?.on("data", (chunk) => { stderr += chunk.toString() })
    child.on("error", (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    child.on("close", (code) => {
      clearTimeout(timeout)
      if (code === 0) resolve({ stdout, stderr })
      else reject(new Error(stderr || stdout || `${command} exited with code ${code}`))
    })
  })
}

async function extractVideoTextWithWhisper({ fileName = "video", mimeType = "video/mp4", data = "" } = {}) {
  if (env("WHISPER_ENABLED") === "0" || !data) return null
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "factra-whisper-"))
  const ext = path.extname(fileName) || (mimeType.includes("webm") ? ".webm" : ".mp4")
  const inputPath = path.join(tempDir, `input${ext}`)
  const outputJson = path.join(tempDir, "input.json")
  try {
    await fs.writeFile(inputPath, Buffer.from(data, "base64"))
    const model = env("WHISPER_MODEL") || "large-v3"
    const command = env("WHISPER_COMMAND") || "python"
    const backend = env("WHISPER_BACKEND")
    const args = backend === "faster-whisper"
      ? [path.join(process.cwd(), "backend", "services", "faster_whisper_transcribe.py"), inputPath, "--model", model, "--output_dir", tempDir]
      : command.toLowerCase().includes("whisper")
        ? [inputPath, "--model", model, "--task", "transcribe", "--output_format", "json", "--output_dir", tempDir]
        : ["-m", "whisper", inputPath, "--model", model, "--task", "transcribe", "--output_format", "json", "--output_dir", tempDir]
    await runProcess(command, args, { cwd: process.cwd() })
    const parsed = JSON.parse(await fs.readFile(outputJson, "utf8"))
    const segments = Array.isArray(parsed.segments) ? parsed.segments : []
    const speechTranscript = segments.length
      ? segments.map((segment) => `[${secondsToTimestamp(segment.start)}] ${String(segment.text || "").trim()}`).filter(Boolean).join("\n")
      : String(parsed.text || "").trim()
    if (!speechTranscript) return null
    return {
      fileName,
      visibleText: "",
      speechTranscript,
      combinedText: speechTranscript,
      notes: `Speech transcribed locally with Whisper ${model}.`,
      model: `whisper-${model}`,
    }
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
  }
}
export async function extractVideoTextWithGemini({ fileName = "video", mimeType = "video/mp4", data = "" } = {}) {
  if (!data) throw new Error("Video data is missing")
  const whisperExtraction = await extractVideoTextWithWhisper({ fileName, mimeType, data }).catch(() => null)
  const key = env("GEMINI_API_KEY") || env("GOOGLE_API_KEY")
  if (!key) {
    if (whisperExtraction) return whisperExtraction
    throw new Error("Gemini API key is missing")
  }

  const ai = new GoogleGenAI({ apiKey: key })
  let response
  try {
    response = await ai.models.generateContent({
      model: env("GEMINI_MODEL") || "gemini-2.5-flash",
      contents: [
        {
          text:
            "Analyze this uploaded video for fact-checking. Extract all visible text from frames and transcribe any spoken words with timestamps where possible. Return only JSON with keys visibleText, speechTranscript, combinedText, and notes. If there is no speech, speechTranscript should be empty. If there is no visible text, visibleText should be empty.",
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
  } catch (error) {
    if (whisperExtraction) {
      return {
        ...whisperExtraction,
        notes: `${whisperExtraction.notes} ${userSafeServiceMessage(error, "Gemini visible-text extraction failed.")}`,
      }
    }
    throw new Error(userSafeServiceMessage(error, "Video extraction failed."))
  }

  const parsed = parseJsonFromText(response.text)
  const visibleText = String(parsed.visibleText || "").trim()
  const geminiSpeech = String(parsed.speechTranscript || "").trim()
  const speechTranscript = whisperExtraction?.speechTranscript || geminiSpeech
  const combinedText = String(parsed.combinedText || [visibleText, speechTranscript].filter(Boolean).join("\n\n")).trim()
  const notes = [whisperExtraction?.notes, String(parsed.notes || "").trim()].filter(Boolean).join(" ")

  return {
    fileName,
    visibleText,
    speechTranscript,
    combinedText,
    notes,
    model: [whisperExtraction?.model, env("GEMINI_MODEL") || "gemini-2.5-flash"].filter(Boolean).join(" + "),
  }
}
export async function extractVideoLinkContext({ url = "" } = {}) {
  const videoUrl = String(url || "").trim()
  if (!videoUrl) throw new Error("Video URL is required")

  const extracted = await extractLinkContext({ url: videoUrl, kind: "video" })
  if (!extracted.combinedText && !extracted.speechTranscript && !extracted.visibleText) {
    return {
      ...extracted,
      combinedText: "",
      notes: extracted.notes || "No specific claim could be extracted from this public video link. Upload the video file or paste the transcript/spoken claim.",
    }
  }
  return extracted
}







