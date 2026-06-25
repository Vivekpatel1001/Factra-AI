import { ExternalLink, FileSearch } from "lucide-react"
import { useApp } from "../context/AppContext.jsx"

export default function EvidenceCard({ source, explanation, link }) {
  const { t } = useApp()
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <FileSearch className="h-6 w-6" />
        </span>
        <div>
          <p className="font-display text-base font-bold">{source}</p>
          <p className="mt-0.5 text-base leading-relaxed text-muted-foreground">{explanation}</p>
        </div>
      </div>
      <a
        href={link || "#"}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-base font-semibold text-primary hover:bg-muted"
      >
        {t("view_source")} <ExternalLink className="h-4 w-4" />
      </a>
    </div>
  )
}
