import { Clock } from "lucide-react"
import { getVerdict } from "../lib/verdicts.js"
import { useApp } from "../context/AppContext.jsx"

export default function VideoTimeline({ items = [] }) {
  const { t } = useApp()

  return (
    <div>
      <h3 className="font-display text-xl font-bold">{t("video_found_title")}</h3>
      <p className="mt-1 text-base text-muted-foreground">
        {t("video_found_desc")}
      </p>

      <ol className="mt-5 flex flex-col gap-4">
        {items.map((item, i) => {
          const v = getVerdict(item.result, t)
          const Icon = v.icon
          return (
            <li key={i} className="relative flex gap-4">
              <div className="flex flex-col items-center">
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: v.color }}
                >
                  <Icon className="h-6 w-6" />
                </span>
                {i < items.length - 1 && <span className="mt-1 w-0.5 flex-1 bg-border" />}
              </div>
              <div className="flex-1 rounded-2xl border border-border bg-background p-4">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm font-bold text-foreground">
                  <Clock className="h-4 w-4" /> {item.time}
                </span>
                <p className="mt-2 break-words text-lg font-semibold">{item.claim}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className="inline-flex rounded-full px-3 py-1 text-sm font-bold"
                    style={{ color: v.color, backgroundColor: v.soft }}
                  >
                    {v.label}
                  </span>
                  {typeof item.trustScore === "number" && (
                    <span className="inline-flex rounded-full bg-muted px-3 py-1 text-sm font-bold text-muted-foreground">
                      {item.trustScore}/100
                    </span>
                  )}
                </div>
                {(item.result === "RISKY" || item.result === "MANIPULATIVE" || item.result === "FALSE") && (
                  <p className="mt-2 text-sm font-semibold text-muted-foreground">
                    {t("video_warning")}
                  </p>
                )}
                {item.meaning && (
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.meaning}</p>
                )}
                {item.evidence?.length > 0 && (
                  <div className="mt-3 flex flex-col gap-2">
                    {item.evidence.slice(0, 2).map((evidence) => (
                      <a
                        key={evidence.link || evidence.source}
                        href={evidence.link && evidence.link !== "#" ? evidence.link : undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-2xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                      >
                        <span className="font-semibold text-foreground">{evidence.source}</span>
                        <span className="mt-1 line-clamp-2 block">{evidence.explanation}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
