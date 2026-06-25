// Mock verification results used while the backend is not connected.

const evidence = (source, explanation) => ({ source, explanation, link: "#" })

function buildVideoTimeline(transcript, t) {
  const lines = transcript
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (!lines.length) {
    return [
      { time: "00:12", claim: t("mock_video_timeline_1"), result: "FALSE" },
      { time: "00:28", claim: t("mock_video_timeline_2"), result: "RISKY" },
      { time: "00:40", claim: t("mock_video_timeline_3"), result: "MANIPULATIVE" },
    ]
  }

  return lines.map((line, index) => {
    const timeMatch = line.match(/\[?(\d{1,2}:\d{2})\]?/)
    const time = timeMatch?.[1] || `00:${String((index + 1) * 12).padStart(2, "0")}`
    const claim = line.replace(/\[?\d{1,2}:\d{2}\]?\s*/, "")
    const lower = claim.toLowerCase()
    const result =
      /register|claim your reward|link|details|otp|password|bank/.test(lower)
        ? "RISKY"
        : /share|forward|everyone|removed|urgent/.test(lower)
          ? "MANIPULATIVE"
          : /free money|government.*money|guaranteed|everyone/.test(lower)
            ? "FALSE"
            : "UNVERIFIED"

    return { time, claim, result }
  })
}

export function getMockResult(inputType, t = (key) => key, content = {}) {
  if (inputType === "video") {
    const transcript = content.transcript?.trim()
    return {
      verdict: "MISLEADING",
      trustScore: 34,
      claim: transcript || t("mock_video_claim"),
      meaning: t("mock_video_meaning"),
      transcript,
      timeline: buildVideoTimeline(transcript || "", t),
      evidence: [
        evidence(t("mock_video_source_1"), t("mock_video_evidence_1")),
        evidence(t("mock_video_source_2"), t("mock_video_evidence_2")),
      ],
      recommendation: t("mock_video_recommendation"),
    }
  }

  return {
    verdict: "FALSE",
    trustScore: 18,
    claim: content.text || content.link || content.fileName || t("mock_text_claim"),
    meaning: t("mock_text_meaning"),
    evidence: [
      evidence(t("mock_text_source_1"), t("mock_text_evidence_1")),
      evidence(t("mock_text_source_2"), t("mock_text_evidence_2")),
      evidence(t("mock_text_source_3"), t("mock_text_evidence_3")),
    ],
    recommendation: t("mock_text_recommendation"),
  }
}
