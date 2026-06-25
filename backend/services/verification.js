import { translations } from "../../src/lib/translations.js"

const evidence = (source, explanation) => ({ source, explanation, link: "#" })

const read = (language, key) => {
  const dict = translations[language] || translations.en
  return dict[key] || translations.en[key] || key
}

export function createVerificationResult(payload = {}) {
  const inputType = ["text", "link", "image", "video"].includes(payload.type) ? payload.type : "text"
  const language = translations[payload.language] ? payload.language : "en"
  const t = (key) => read(language, key)

  if (inputType === "video") {
    return {
      inputType,
      language,
      verdict: "MISLEADING",
      trustScore: 34,
      claim: payload.content?.fileName || payload.content?.text || t("mock_video_claim"),
      meaning: t("mock_video_meaning"),
      timeline: [
        { time: "00:12", claim: t("mock_video_timeline_1"), result: "FALSE" },
        { time: "00:28", claim: t("mock_video_timeline_2"), result: "RISKY" },
        { time: "00:41", claim: t("mock_video_timeline_3"), result: "UNVERIFIED" },
      ],
      evidence: [
        evidence(t("mock_video_source_1"), t("mock_video_evidence_1")),
        evidence(t("mock_video_source_2"), t("mock_video_evidence_2")),
      ],
      recommendation: t("mock_video_recommendation"),
    }
  }

  const claim = payload.content?.text || payload.content?.link || payload.content?.fileName || t("mock_text_claim")

  return {
    inputType,
    language,
    verdict: "FALSE",
    trustScore: inputType === "link" ? 26 : 18,
    claim,
    meaning: t("mock_text_meaning"),
    evidence: [
      evidence(t("mock_text_source_1"), t("mock_text_evidence_1")),
      evidence(t("mock_text_source_2"), t("mock_text_evidence_2")),
      evidence(t("mock_text_source_3"), t("mock_text_evidence_3")),
    ],
    recommendation: t("mock_text_recommendation"),
  }
}
