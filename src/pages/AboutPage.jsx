import { Heart, ShieldCheck, Eye, Users } from "lucide-react"
import Card from "../components/ui/Card.jsx"
import ScrollReveal from "../components/ScrollReveal.jsx"
import { useApp } from "../context/AppContext.jsx"

export default function AboutPage() {
  const { t } = useApp()
  const values = [
    { icon: ShieldCheck, title: t("about_value_1_title"), desc: t("about_value_1_desc") },
    { icon: Eye, title: t("about_value_2_title"), desc: t("about_value_2_desc") },
    { icon: Users, title: t("about_value_3_title"), desc: t("about_value_3_desc") },
    { icon: Heart, title: t("about_value_4_title"), desc: t("about_value_4_desc") },
  ]
  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <ScrollReveal className="text-center">
        <h1 className="text-balance font-display text-4xl font-extrabold sm:text-5xl">{t("about_title")}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
          {t("about_subtitle")}
        </p>
      </ScrollReveal>

      <div className="mt-12 grid gap-5 sm:grid-cols-2">
        {values.map((v, i) => {
          const Icon = v.icon
          return (
            <ScrollReveal key={v.title} delay={i * 90}>
              <Card className="flex h-full items-start gap-4 p-6">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                  <Icon className="h-6 w-6" />
                </span>
                <div>
                  <h3 className="font-display text-lg font-bold">{v.title}</h3>
                  <p className="mt-1 text-base leading-relaxed text-muted-foreground">{v.desc}</p>
                </div>
              </Card>
            </ScrollReveal>
          )
        })}
      </div>

      <ScrollReveal direction="zoom">
        <Card className="mt-10 bg-primary-soft p-8 text-center">
          <h2 className="font-display text-2xl font-bold text-primary">{t("our_promise")}</h2>
          <p className="mx-auto mt-3 max-w-xl text-pretty text-lg leading-relaxed text-foreground">
            {t("promise_desc")}
          </p>
        </Card>
      </ScrollReveal>
    </div>
  )
}
