function reportKey(prefix, verdict) {
  return `${prefix}_${String(verdict || "UNVERIFIED").toLowerCase()}`
}

function localizeEvidenceSource(source, t) {
  return String(source || "")
    .replace(/^(Official source|आधिकारिक स्रोत|સત્તાવાર સ્ત્રોત):\s*/i, `${t("evidence_prefix_official")} `)
    .replace(/^(Fact-check source|फैक्ट-चेक स्रोत|ફેક્ટ-ચેક સ્ત્રોત):\s*/i, `${t("evidence_prefix_factcheck")} `)
    .replace(/^No strong live evidence found$/i, t("evidence_none_title"))
    .replace(/^No checkable claim extracted$/i, t("no_checkable_claim_source"))
}

function localizeTrustLevel(entry, t) {
  const level = String(entry?.trustLevel || "").toLowerCase()
  if (level.includes("official") || level.includes("primary") || level.includes("आधिकारिक") || level.includes("સત્તાવાર")) {
    return t("trust_level_official")
  }
  if (level.includes("fact") || level.includes("फैक्ट") || level.includes("ફેક્ટ")) return t("trust_level_factcheck")
  if (level.includes("news") || level.includes("न्यूज") || level.includes("ન્યૂઝ")) return t("trust_level_news")
  if (level.includes("social") || level.includes("सोशल") || level.includes("સોશિયલ")) return t("trust_level_social")
  return t("trust_level_unknown")
}

function localizeEvidenceList(items, t) {
  return Array.isArray(items)
    ? items.map((item) => ({
      ...item,
      source: localizeEvidenceSource(item.source, t),
      trustLevel: localizeTrustLevel(item, t),
    }))
    : items
}

function fallbackMeaningForVerdict(verdict, t) {
  return t(reportKey("report_meaning", verdict)) || ""
}

function recommendationForVerdict(verdict, t) {
  return t(reportKey("report_recommend", verdict)) || ""
}

export function applyReportShell(result, t) {
  if (!result) return null

  return {
    ...result,
    recommendation: recommendationForVerdict(result.verdict, t) || result.recommendation,
    claims: Array.isArray(result.claims)
      ? result.claims.map((item) => ({
        ...item,
        recommendation: recommendationForVerdict(item.verdict, t) || item.recommendation,
        evidence: localizeEvidenceList(item.evidence, t),
      }))
      : result.claims,
    evidence: localizeEvidenceList(result.evidence, t),
    retrieval: result.retrieval
      ? {
        ...result.retrieval,
        engine: t(result.retrieval.engineKey || "retrieval_engine"),
        vectorIndex: t(result.retrieval.vectorIndexKey || "retrieval_vector_index"),
      }
      : result.retrieval,
    timeline: Array.isArray(result.timeline)
      ? result.timeline.map((item) => ({
        ...item,
        evidence: localizeEvidenceList(item.evidence, t),
      }))
      : result.timeline,
  }
}

export function localizeReportInstant(result, language, t) {
  if (!result) return null

  const shell = applyReportShell(result, t)
  const localizedClaims = Array.isArray(shell.claims)
    ? shell.claims.map((item) => ({
      ...item,
      meaning: fallbackMeaningForVerdict(item.verdict, t) || item.meaning,
    }))
    : shell.claims

  return {
    ...shell,
    language,
    meaning: fallbackMeaningForVerdict(result.verdict, t) || result.meaning,
    claims: localizedClaims,
  }
}

export function reportCacheKey(result, language) {
  const claim = String(result?.claim || "").slice(0, 120)
  const verdict = String(result?.verdict || "")
  const sourceLanguage = resolveSourceLanguage(result)
  return `${sourceLanguage}|${language}|${verdict}|${claim}`
}

export function resolveSourceLanguage(result) {
  if (result?.language) return result.language
  const sample = [
    result?.claim,
    result?.meaning,
    ...(Array.isArray(result?.claims) ? result.claims.map((item) => item.text) : []),
  ].filter(Boolean).join(" ")
  const devanagari = (sample.match(/[\u0900-\u097F]/g) || []).length
  const gujarati = (sample.match(/[\u0A80-\u0AFF]/g) || []).length
  if (gujarati > devanagari && gujarati > 8) return "gu"
  if (devanagari > 8) return "hi"
  return "en"
}
