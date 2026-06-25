import { Upload, Brain, Library, BadgeCheck } from "lucide-react"
import Card from "./ui/Card.jsx"
import ScrollReveal from "./ScrollReveal.jsx"
import { useApp } from "../context/AppContext.jsx"

const steps = [
  {
    icon: Upload,
    titleKey: "how_step_1_title",
    descKey: "how_step_1_desc",
  },
  {
    icon: Brain,
    titleKey: "how_step_2_title",
    descKey: "how_step_2_desc",
  },
  {
    icon: Library,
    titleKey: "how_step_3_title",
    descKey: "how_step_3_desc",
  },
  {
    icon: BadgeCheck,
    titleKey: "how_step_4_title",
    descKey: "how_step_4_desc",
  },
]

export default function HowItWorks({ id }) {
  const { t } = useApp()

  return (
    <section id={id} className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <ScrollReveal className="mx-auto max-w-2xl text-center">
        <span className="inline-flex rounded-full bg-primary-soft px-4 py-1.5 text-sm font-semibold text-primary">
          {t("simple_4_steps")}
        </span>
        <h2 className="mt-4 text-balance font-display text-3xl font-extrabold sm:text-4xl">
          {t("how_it_works")}
        </h2>
        <p className="mt-3 text-pretty text-lg leading-relaxed text-muted-foreground">
          {t("how_intro")}
        </p>
      </ScrollReveal>

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, i) => {
          const Icon = step.icon
          return (
            <ScrollReveal key={step.titleKey} delay={i * 100}>
              <Card className="relative h-full p-6">
                <span className="absolute -top-3 left-6 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {i + 1}
                </span>
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                  <Icon className="h-7 w-7" />
                </span>
                <h3 className="mt-4 font-display text-lg font-bold">{t(step.titleKey)}</h3>
                <p className="mt-2 text-base leading-relaxed text-muted-foreground">{t(step.descKey)}</p>
              </Card>
            </ScrollReveal>
          )
        })}
      </div>
    </section>
  )
}
