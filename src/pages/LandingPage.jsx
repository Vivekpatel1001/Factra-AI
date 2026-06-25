import { useNavigate } from "react-router-dom"
import { ArrowRight, Users, Clock, ShieldCheck } from "lucide-react"
import HeroSection from "../components/HeroSection.jsx"
import HowItWorks from "../components/HowItWorks.jsx"
import Button from "../components/ui/Button.jsx"
import Card from "../components/ui/Card.jsx"
import ScrollReveal from "../components/ScrollReveal.jsx"
import { useApp } from "../context/AppContext.jsx"

export default function LandingPage() {
  const { t } = useApp()
  const navigate = useNavigate()

  const trust = [
    { icon: Clock, title: t("trust_fast_title"), desc: t("trust_fast_desc") },
    { icon: Users, title: t("trust_everyone_title"), desc: t("trust_everyone_desc") },
    { icon: ShieldCheck, title: t("trust_sources_title"), desc: t("trust_sources_desc") },
  ]

  return (
    <div>
      <HeroSection />

      <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {trust.map((item, i) => {
            const Icon = item.icon
            return (
              <ScrollReveal key={item.title} delay={i * 90}>
                <Card className="flex h-full items-start gap-4 p-5">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                    <Icon className="h-6 w-6" />
                  </span>
                  <div>
                    <h3 className="font-display text-base font-bold">{item.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
                  </div>
                </Card>
              </ScrollReveal>
            )
          })}
        </div>
      </section>

      <HowItWorks id="how-it-works" />

      <section className="mx-auto max-w-6xl px-4 pb-8 sm:px-6">
        <ScrollReveal direction="zoom">
          <Card className="overflow-hidden bg-primary p-8 text-center sm:p-12">
            <h2 className="text-balance font-display text-3xl font-extrabold text-primary-foreground sm:text-4xl">
              {t("cta_title")}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-pretty text-lg leading-relaxed text-primary-foreground/85">
              {t("cta_desc")}
            </p>
            <Button
              variant="secondary"
              size="xl"
              className="mt-6"
              onClick={() => navigate("/verify")}
            >
              {t("verify_now")} <ArrowRight className="h-5 w-5" />
            </Button>
          </Card>
        </ScrollReveal>
      </section>
    </div>
  )
}
