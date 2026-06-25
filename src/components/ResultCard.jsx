import { Download, Share2, RotateCcw, Lightbulb, Megaphone } from "lucide-react"
import Card from "./ui/Card.jsx"
import Button from "./ui/Button.jsx"
import TrustScore from "./TrustScore.jsx"
import EvidenceCard from "./EvidenceCard.jsx"
import VideoTimeline from "./VideoTimeline.jsx"
import { getVerdict } from "../lib/verdicts.js"
import { useApp } from "../context/AppContext.jsx"

export default function ResultCard({ result, onReset }) {
  const { t } = useApp()
  const v = getVerdict(result.verdict, t)
  const Icon = v.icon

  const handleDownload = () => {
    const lines = [
      t("report_title"),
      "================================",
      "",
      `${t("claim_label")}: ${result.claim}`,
      `${t("verdict_label")}: ${v.label}`,
      `${t("trust_score")}: ${result.trustScore}/100`,
      "",
      `${t("what_means")}: ${result.meaning}`,
      "",
      `${t("why_say")}:`,
      ...result.evidence.map((e) => `- ${e.source}: ${e.explanation}`),
      "",
      `${t("recommend")}: ${result.recommendation}`,
    ]
    const blob = new Blob([lines.join("\n")], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "factra-ai-report.txt"
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleShare = async () => {
    const text = `${t("share_checked")}\n${t("verdict_label")}: ${v.label} (${t("trust_score")} ${result.trustScore}/100)\n${result.meaning}`
    if (navigator.share) {
      try {
        await navigator.share({ title: t("share_title"), text })
      } catch {
        /* user cancelled */
      }
    } else {
      await navigator.clipboard?.writeText(text)
      alert(t("result_copied"))
    }
  }

  return (
    <div className="mx-auto max-w-3xl animate-float-up">
      <Card className="overflow-hidden">
        {/* Verdict header */}
        <div className="flex flex-col items-center gap-6 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8" style={{ backgroundColor: v.soft }}>
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: v.color }}>
              <Icon className="h-9 w-9" />
            </span>
            <div>
              <p className="text-base font-medium text-muted-foreground">{t("result_is")}</p>
              <h2 className="font-display text-3xl font-extrabold sm:text-4xl" style={{ color: v.color }}>
                {v.label}
              </h2>
              <p className="mt-1 text-base font-medium" style={{ color: v.color }}>
                {v.text}
              </p>
            </div>
          </div>
          <TrustScore score={result.trustScore} />
        </div>

        <div className="p-6 sm:p-8">
          {/* Claim */}
          <div className="rounded-2xl bg-muted px-4 py-3">
            <p className="text-sm font-semibold text-muted-foreground">{t("you_asked_check")}</p>
            <p className="mt-1 text-lg font-medium">{result.claim}</p>
          </div>

          {/* What this means */}
          <div className="mt-6">
            <h3 className="flex items-center gap-2 font-display text-xl font-bold">
              <Lightbulb className="h-6 w-6 text-primary" /> {t("what_means")}
            </h3>
            <p className="mt-2 text-lg leading-relaxed text-foreground">{result.meaning}</p>
          </div>

          {/* Video timeline */}
          {result.timeline && (
            <div className="mt-8">
              <VideoTimeline items={result.timeline} />
            </div>
          )}

          {/* Evidence */}
          <div className="mt-8">
            <h3 className="font-display text-xl font-bold">{t("why_say")}</h3>
            <div className="mt-3 flex flex-col gap-3">
              {result.evidence.map((e, i) => (
                <EvidenceCard key={i} {...e} />
              ))}
            </div>
          </div>

          {/* Recommendation */}
          <div
            className="mt-8 flex items-start gap-3 rounded-2xl border-2 p-5"
            style={{ borderColor: v.color, backgroundColor: v.soft }}
          >
            <Megaphone className="h-7 w-7 shrink-0" style={{ color: v.color }} />
            <div>
              <p className="font-display text-lg font-bold" style={{ color: v.color }}>
                {t("recommend")}
              </p>
              <p className="mt-0.5 text-lg font-medium text-foreground">{result.recommendation}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <Button variant="secondary" size="lg" onClick={handleDownload}>
              <Download className="h-5 w-5" /> {t("download_report")}
            </Button>
            <Button variant="secondary" size="lg" onClick={handleShare}>
              <Share2 className="h-5 w-5" /> {t("share_result")}
            </Button>
            <Button size="lg" onClick={onReset}>
              <RotateCcw className="h-5 w-5" /> {t("check_another")}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
