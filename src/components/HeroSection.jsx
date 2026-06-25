import { useNavigate } from "react-router-dom"
import { ArrowRight, Bot, CheckCircle2, FileSearch, Link2, MessageSquareText, ShieldCheck, Video, XCircle } from "lucide-react"
import Button from "./ui/Button.jsx"
import Card from "./ui/Card.jsx"
import ScrollReveal from "./ScrollReveal.jsx"
import { useApp } from "../context/AppContext.jsx"

export default function HeroSection() {
  const { t } = useApp()
  const navigate = useNavigate()

  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 pt-14 pb-10 sm:px-6 sm:pt-20 lg:grid-cols-[1fr_0.9fr]">
        <ScrollReveal className="text-center lg:text-left">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-primary shadow-sm">
            <ShieldCheck className="h-4 w-4" /> {t("hero_badge")}
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-balance font-display text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl lg:mx-0">
            {t("hero_title")}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl lg:mx-0">
            {t("hero_subtitle")}
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
            <Button size="xl" className="w-full sm:w-auto" onClick={() => navigate("/verify")}>
              {t("verify_now")} <ArrowRight className="h-5 w-5" />
            </Button>
            <Button as="a" href="#how-it-works" variant="secondary" size="xl" className="w-full sm:w-auto">
              {t("see_how_it_works")}
            </Button>
          </div>
        </ScrollReveal>

        <ScrollReveal direction="right" delay={140}>
          <Card glass className="relative overflow-hidden p-6 sm:p-8">
            <div className="pointer-events-none absolute inset-x-0 top-16 h-12 bg-primary/10 blur-xl" />
            <div className="absolute left-0 top-12 h-0.5 w-full animate-scan bg-gradient-to-r from-transparent via-primary to-transparent" />
            <div className="relative flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">{t("hero_card_label")}</p>
                <h2 className="mt-1 font-display text-2xl font-extrabold">{t("hero_card_title")}</h2>
              </div>
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                <Bot className="h-7 w-7" />
              </span>
            </div>

            <div className="relative mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-[var(--color-false)]/30 bg-[var(--color-false-soft)] p-4">
                <div className="flex items-center gap-2 text-[var(--color-false)]">
                  <XCircle className="h-5 w-5" />
                  <span className="font-bold">{t("verdict_label")}</span>
                </div>
                <p className="mt-3 font-display text-3xl font-extrabold text-[var(--color-false)]">{t("verdict_false")}</p>
              </div>
              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="font-bold text-muted-foreground">{t("trust_score")}</p>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full w-[18%] rounded-full bg-[var(--color-false)]" />
                </div>
                <p className="mt-2 font-display text-2xl font-extrabold">18/100</p>
              </div>
            </div>

            <div className="relative mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="text-sm font-semibold text-muted-foreground">{t("status")}</p>
                <p className="mt-1 font-display text-xl font-bold text-[var(--color-false)]">{t("do_not_share")}</p>
              </div>
              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="text-sm font-semibold text-muted-foreground">{t("evidence_found")}</p>
                <p className="mt-1 font-display text-xl font-bold text-[var(--color-true)]">3 {t("trusted_sources")}</p>
              </div>
            </div>

            <div className="relative mt-6 grid grid-cols-4 gap-3">
              {[MessageSquareText, Link2, FileSearch, Video].map((Icon, i) => (
                <span key={i} className="flex aspect-square items-center justify-center rounded-2xl border border-border bg-background text-primary">
                  <Icon className="h-6 w-6" />
                </span>
              ))}
            </div>
            <div className="relative mt-5 flex items-center gap-2 rounded-2xl border border-[var(--color-true)]/25 bg-[var(--color-true-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-true)]">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <span className="break-words">{t("hero_card_note")}</span>
            </div>
          </Card>
        </ScrollReveal>
      </div>
    </section>
  )
}
