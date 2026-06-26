import { Download, Share2, RotateCcw, Lightbulb, Megaphone, Database, AlertCircle } from "lucide-react"
import jsPDF from "jspdf"
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
  const trustBreakdown = result.trustBreakdown
  const trustMetrics = trustBreakdown
    ? [
        ["Evidence quality", trustBreakdown.evidenceQuality],
        ["Recency", trustBreakdown.recency],
        ["Source reliability", trustBreakdown.sourceReliability],
        ["Claim clarity", trustBreakdown.claimClarity],
        ["Confidence", trustBreakdown.confidence],
      ]
    : []
  const extractedClaims = Array.isArray(result.claims) ? result.claims : []

  const handleDownload = () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" })
    const margin = 44
    const width = doc.internal.pageSize.getWidth() - margin * 2
    let y = 48

    const addText = (value, size = 11, style = "normal", color = [35, 35, 35]) => {
      doc.setFont("helvetica", style)
      doc.setFontSize(size)
      doc.setTextColor(...color)
      const lines = doc.splitTextToSize(String(value || ""), width)
      for (const line of lines) {
        if (y > 780) {
          doc.addPage()
          y = 48
        }
        doc.text(line, margin, y)
        y += size + 6
      }
      y += 4
    }

    doc.setFillColor(245, 248, 255)
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), 112, "F")
    addText("Factra AI Verification Report", 20, "bold", [21, 78, 138])
    addText(`${t("verdict_label")}: ${v.label}    ${t("trust_score")}: ${result.trustScore}/100`, 13, "bold", [20, 120, 80])
    y = 138

    addText(t("claim_label"), 14, "bold", [21, 78, 138])
    addText(result.claim, 11)
    addText(t("what_means"), 14, "bold", [21, 78, 138])
    addText(result.meaning, 11)

    if (trustMetrics.length) {
      addText("Trust score breakdown", 14, "bold", [21, 78, 138])
      trustMetrics.forEach(([label, value]) => addText(`${label}: ${value}/100`, 10))
    }

    if (extractedClaims.length > 1) {
      addText("Extracted checkable claims", 14, "bold", [21, 78, 138])
      extractedClaims.forEach((item, index) => {
        const verdict = getVerdict(item.verdict, t)
        addText(`${index + 1}. ${item.text}`, 10, "bold")
        addText(`${t("verdict_label")}: ${verdict.label}    ${t("trust_score")}: ${item.trustScore}/100`, 10)
      })
    }

    if (result.transcript) {
      addText(t("transcript_result_title"), 14, "bold", [21, 78, 138])
      addText(result.transcript, 10)
    }

    addText(t("why_say"), 14, "bold", [21, 78, 138])
    result.evidence.forEach((item, index) => {
      addText(`${index + 1}. ${item.source}`, 11, "bold")
      addText(`${item.explanation}${item.link && item.link !== "#" ? `\nSource: ${item.link}` : ""}`, 10)
    })

    addText(t("recommend"), 14, "bold", [21, 78, 138])
    addText(result.recommendation, 11)
    addText(`Generated: ${new Date().toLocaleString()}`, 9, "normal", [95, 95, 95])

    doc.save("factra-ai-report.pdf")
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
          <div className="rounded-2xl bg-muted px-4 py-3">
            <p className="text-sm font-semibold text-muted-foreground">{t("you_asked_check")}</p>
            <p className="mt-1 text-lg font-medium">{result.claim}</p>
          </div>

          <div className="mt-6">
            <h3 className="flex items-center gap-2 font-display text-xl font-bold">
              <Lightbulb className="h-6 w-6 text-primary" /> {t("what_means")}
            </h3>
            <p className="mt-2 text-lg leading-relaxed text-foreground">{result.meaning}</p>
          </div>
          {!!trustMetrics.length && (
            <div className="mt-8">
              <h3 className="font-display text-xl font-bold">Trust score breakdown</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {trustMetrics.map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-border bg-background p-4">
                    <div className="flex items-center justify-between gap-3 text-sm font-bold">
                      <span className="text-foreground">{label}</span>
                      <span className="text-muted-foreground">{value}/100</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, value || 0))}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {extractedClaims.length > 1 && (
            <div className="mt-8">
              <h3 className="font-display text-xl font-bold">Extracted checkable claims</h3>
              <div className="mt-3 grid gap-3">
                {extractedClaims.map((item) => {
                  const claimVerdict = getVerdict(item.verdict, t)
                  return (
                    <div key={item.id || item.text} className="rounded-2xl border border-border bg-background p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <p className="break-words text-base font-semibold text-foreground">{item.text}</p>
                        <span
                          className="inline-flex shrink-0 rounded-full px-3 py-1 text-sm font-bold"
                          style={{ color: claimVerdict.color, backgroundColor: claimVerdict.soft }}
                        >
                          {claimVerdict.label} - {item.trustScore}/100
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.meaning}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {result.timeline && (
            <div className="mt-8">
              {result.transcript && (
                <div className="mb-6 rounded-2xl border border-border bg-background p-5">
                  <h3 className="font-display text-xl font-bold">{t("transcript_result_title")}</h3>
                  <p className="mt-2 whitespace-pre-wrap break-words text-base leading-relaxed text-muted-foreground">
                    {result.transcript}
                  </p>
                </div>
              )}
              <VideoTimeline items={result.timeline} />
            </div>
          )}

          {result.retrieval && (
            <div className="mt-8 rounded-2xl border border-border bg-background p-5">
              <h3 className="flex items-center gap-2 font-display text-xl font-bold">
                <Database className="h-6 w-6 text-primary" /> Evidence pipeline
              </h3>
              <div className="mt-3 grid gap-3 text-sm font-semibold text-muted-foreground sm:grid-cols-3">
                <span className="rounded-2xl bg-card px-4 py-3">{result.retrieval.engine}</span>
                <span className="rounded-2xl bg-card px-4 py-3">{result.retrieval.vectorIndex}</span>
                <span className="rounded-2xl bg-card px-4 py-3">Model: {result.retrieval.model}</span>
              </div>
              {!!result.retrieval.searchErrors?.length && (
                <div className="mt-3 rounded-2xl bg-[var(--color-misleading-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-misleading)]">
                  <span className="inline-flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" /> Some providers failed, so the result used the available evidence and fallback handling.
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="mt-8">
            <h3 className="font-display text-xl font-bold">{t("why_say")}</h3>
            <div className="mt-3 flex flex-col gap-3">
              {result.evidence.map((e, i) => (
                <EvidenceCard key={i} {...e} />
              ))}
            </div>
          </div>

          <div className="mt-8 flex items-start gap-3 rounded-2xl border-2 p-5" style={{ borderColor: v.color, backgroundColor: v.soft }}>
            <Megaphone className="h-7 w-7 shrink-0" style={{ color: v.color }} />
            <div>
              <p className="font-display text-lg font-bold" style={{ color: v.color }}>
                {t("recommend")}
              </p>
              <p className="mt-0.5 text-lg font-medium text-foreground">{result.recommendation}</p>
            </div>
          </div>

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
