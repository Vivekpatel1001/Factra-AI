import { useNavigate } from "react-router-dom"
import { ArrowRight, ShieldCheck } from "lucide-react"
import Button from "./ui/Button.jsx"
import ScrollReveal from "./ScrollReveal.jsx"
import { useApp } from "../context/AppContext.jsx"

export default function HeroSection() {
  const { t } = useApp()
  const navigate = useNavigate()

  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto flex max-w-7xl items-center justify-center px-4 pt-16 pb-14 sm:px-6 sm:pt-24 sm:pb-18 lg:min-h-[calc(100vh-12rem)] lg:pt-20 lg:pb-16">
        <ScrollReveal className="mx-auto max-w-5xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-base font-semibold text-primary shadow-sm">
            <ShieldCheck className="h-4 w-4" /> {t("hero_badge")}
          </span>
          <h1 className="mx-auto mt-7 max-w-5xl text-balance font-display text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-7xl lg:text-8xl">
            {t("hero_title")}
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-pretty text-xl leading-relaxed text-muted-foreground sm:text-2xl">
            {t("hero_subtitle")}
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="xl" className="w-full sm:w-auto" onClick={() => navigate("/verify")}>
              {t("verify_now")} <ArrowRight className="h-5 w-5" />
            </Button>
            <Button as="a" href="#how-it-works" variant="secondary" size="xl" className="w-full sm:w-auto">
              {t("see_how_it_works")}
            </Button>
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
