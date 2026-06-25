// Mock verification results used while the backend is not connected.

const evidence = (source, explanation) => ({ source, explanation, link: "#" })

export function getMockResult(inputType, t = (key) => key) {
  if (inputType === "video") {
    return {
      verdict: "MISLEADING",
      trustScore: 34,
      claim: t("mock_video_claim"),
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

  return {
    verdict: "FALSE",
    trustScore: 18,
    claim: t("mock_text_claim"),
    meaning: t("mock_text_meaning"),
    evidence: [
      evidence(t("mock_text_source_1"), t("mock_text_evidence_1")),
      evidence(t("mock_text_source_2"), t("mock_text_evidence_2")),
      evidence(t("mock_text_source_3"), t("mock_text_evidence_3")),
    ],
    recommendation: t("mock_text_recommendation"),
  }
}
