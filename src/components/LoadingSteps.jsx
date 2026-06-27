import { useEffect, useState } from "react"
import { BookOpen, Search, ShieldCheck, Sparkles, Check, Loader2, Timer } from "lucide-react"
import Card from "./ui/Card.jsx"
import { useApp } from "../context/AppContext.jsx"

const icons = { BookOpen, Search, ShieldCheck, Sparkles }

const steps = [
  { id: "read", labelKey: "loading_read", icon: "BookOpen" },
  { id: "claims", labelKey: "loading_claims", icon: "Search" },
  { id: "sources", labelKey: "loading_sources", icon: "ShieldCheck" },
  { id: "result", labelKey: "loading_result", icon: "Sparkles" },
]

export default function LoadingSteps({ onDone, type = "text" }) {
  const { t } = useApp()
  const [current, setCurrent] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const activeSteps = steps

  useEffect(() => {
    if (current >= activeSteps.length) {
      const finish = setTimeout(() => {
        onDone?.()
      }, 600)
      return () => clearTimeout(finish)
    }
    const timer = setTimeout(() => setCurrent((c) => Math.min(c + 1, activeSteps.length - 1)), type === "video" ? 1700 : 1200)
    return () => clearTimeout(timer)
  }, [current, onDone, activeSteps.length, type])

  useEffect(() => {
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const progress = Math.min(((current + 1) / activeSteps.length) * 92, 92)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-hidden bg-background/95 px-4 backdrop-blur-xl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(37,99,235,0.24),transparent_34%),radial-gradient(circle_at_15%_80%,rgba(16,185,129,0.16),transparent_30%)]" />
      <Card className="relative mx-auto w-full max-w-xl overflow-hidden p-6 text-center animate-float-up sm:p-10">
        <div className="absolute left-0 top-0 h-1 w-full overflow-hidden bg-muted">
          <span className="loader-sweep block h-full w-1/3 rounded-full bg-primary" />
        </div>

        <div className="absolute right-5 top-5 inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-sm font-bold text-muted-foreground">
          <Timer className="h-4 w-4" /> {elapsed}s
        </div>

        <div className="relative mx-auto flex h-32 w-32 items-center justify-center">
          <span className="absolute h-28 w-28 rounded-full border border-primary/30" />
          <span className="absolute h-20 w-20 rounded-full border border-[var(--color-true)]/30" />
          <span className="loader-orbit-dot absolute h-3 w-3 rounded-full bg-primary shadow-lg shadow-primary/50" />
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Loader2 className="h-8 w-8 animate-spin" />
          </span>
        </div>

        <h2 className="mt-4 font-display text-2xl font-bold">{t("loading_title")}</h2>
        <p className="mt-1 text-base text-muted-foreground">{t("loading_subtitle")}</p>

        <div className="mt-6 h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <ul className="mt-8 flex flex-col gap-3 text-left">
          {activeSteps.map((step, i) => {
            const Icon = icons[step.icon]
            const done = i < current
            const active = i === current
            return (
              <li
                key={step.id}
                className={`flex items-center gap-4 rounded-2xl border px-4 py-3 transition-colors ${
                  done
                    ? "border-[var(--color-true)]/30 bg-[var(--color-true-soft)]"
                    : active
                      ? "border-primary bg-primary-soft"
                      : "border-border bg-background opacity-60"
                }`}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    done
                      ? "bg-[var(--color-true)] text-white"
                      : active
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {done ? <Check className="h-5 w-5" /> : active ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
                </span>
                <span className={`text-lg font-medium ${done || active ? "text-foreground" : "text-muted-foreground"}`}>
                  {step.label || t(step.labelKey)}
                  {(active || done) && "..."}
                </span>
              </li>
            )
          })}
        </ul>
      </Card>
    </div>
  )
}
