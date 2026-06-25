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
                <span
                  className="mt-2 inline-flex rounded-full px-3 py-1 text-sm font-bold"
                  style={{ color: v.color, backgroundColor: v.soft }}
                >
                  {v.label}
                </span>
                {(item.result === "RISKY" || item.result === "MANIPULATIVE" || item.result === "FALSE") && (
                  <p className="mt-2 text-sm font-semibold text-muted-foreground">
                    {t("video_warning")}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
