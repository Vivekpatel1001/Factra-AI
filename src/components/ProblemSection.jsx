import { Image, MessageCircleWarning, Video } from "lucide-react"
import Card from "./ui/Card.jsx"
import ScrollReveal from "./ScrollReveal.jsx"
import { useApp } from "../context/AppContext.jsx"

const items = [
  { icon: MessageCircleWarning, titleKey: "problem_viral_title", descKey: "problem_viral_desc" },
  { icon: Image, titleKey: "problem_screenshot_title", descKey: "problem_screenshot_desc" },
  { icon: Video, titleKey: "problem_video_title", descKey: "problem_video_desc" },
]

export default function ProblemSection() {
  const { t } = useApp()
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <ScrollReveal className="mx-auto max-w-2xl text-center">
        <h2 className="text-balance font-display text-3xl font-extrabold sm:text-4xl">{t("problem_title")}</h2>
        <p className="mt-3 text-pretty text-lg text-muted-foreground">{t("problem_subtitle")}</p>
      </ScrollReveal>
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {items.map((item, i) => {
          const Icon = item.icon
          return (
            <ScrollReveal key={item.titleKey} delay={i * 90}>
              <Card className="h-full p-6">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                  <Icon className="h-7 w-7" />
                </span>
                <h3 className="mt-5 break-words font-display text-xl font-bold">{t(item.titleKey)}</h3>
                <p className="mt-2 break-words text-base leading-relaxed text-muted-foreground">{t(item.descKey)}</p>
              </Card>
            </ScrollReveal>
          )
        })}
      </div>
    </section>
  )
}
