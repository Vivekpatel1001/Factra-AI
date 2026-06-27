import { useEffect, useState } from "react"
import { useApp } from "../context/AppContext.jsx"

// Circular trust score from 0 to 100. Verdict wins over raw confidence so the UI cannot show a false claim as trustworthy.
function displayScoreForVerdict(verdict, score) {
  if (verdict === "FALSE" || verdict === "RISKY") return 0
  if (verdict === "MISLEADING" || verdict === "MANIPULATIVE") return 50
  return Math.max(0, Math.min(100, Math.round(Number(score) || 0)))
}

export default function TrustScore({ score = 0, verdict }) {
  const { t } = useApp()
  const [shown, setShown] = useState(0)
  const displayScore = displayScoreForVerdict(verdict, score)

  useEffect(() => {
    let frame
    const start = performance.now()
    const duration = 900
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1)
      setShown(Math.round(p * displayScore))
      if (p < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [displayScore])

  const color =
    displayScore >= 70
      ? "var(--color-true)"
      : displayScore >= 40
        ? "var(--color-misleading)"
        : "var(--color-false)"

  const radius = 54
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (shown / 100) * circumference

  const band = displayScore >= 70 ? t("trust_band_high") : displayScore >= 40 ? t("trust_band_mid") : t("trust_band_low")

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-36 w-36">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--color-muted)" strokeWidth="12" />
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.3s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-3xl font-extrabold" style={{ color }}>
            {shown}
          </span>
          <span className="text-sm font-medium text-muted-foreground">{t("of_100")}</span>
        </div>
      </div>
      <p className="mt-2 text-base font-semibold text-muted-foreground">{t("trust_score")}</p>
      <span
        className="mt-1 rounded-full px-3 py-1 text-sm font-semibold"
        style={{ color, backgroundColor: "color-mix(in srgb, " + color + " 14%, white)" }}
      >
        {band}
      </span>
    </div>
  )
}
