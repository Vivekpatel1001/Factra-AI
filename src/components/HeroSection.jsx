import { useNavigate } from "react-router-dom"
import { MessageSquareText, Link2, Image as ImageIcon, Video, ArrowRight, ShieldCheck } from "lucide-react"
import Button from "./ui/Button.jsx"
import Card from "./ui/Card.jsx"
import ScrollReveal from "./ScrollReveal.jsx"
import { useApp } from "../context/AppContext.jsx"

export default function HeroSection() {
  const { t } = useApp()
  const navigate = useNavigate()

  const cards = [
    { key: "text", icon: MessageSquareText, title: t("check_text"), desc: t("check_text_desc") },
    { key: "link", icon: Link2, title: t("check_link"), desc: t("check_link_desc") },
    { key: "image", icon: ImageIcon, title: t("check_image"), desc: t("check_image_desc") },
    { key: "video", icon: Video, title: t("check_video"), desc: t("check_video_desc") },
  ]

  const goVerify = (key) => navigate("/verify", { state: { tab: key } })

  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-6xl px-4 pt-14 pb-8 sm:px-6 sm:pt-20 text-center">
        <ScrollReveal>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-primary shadow-sm">
            <ShieldCheck className="h-4 w-4" /> {t("hero_badge")}
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-balance font-display text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
            {t("hero_title")}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
            {t("hero_subtitle")}
          </p>
        </ScrollReveal>

        <ScrollReveal delay={120} className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button size="xl" className="w-full sm:w-auto" onClick={() => navigate("/verify")}>
            {t("verify_now")} <ArrowRight className="h-5 w-5" />
          </Button>
          <Button
            as="a"
            href="#how-it-works"
            variant="secondary"
            size="xl"
            className="w-full sm:w-auto"
          >
            {t("how_it_works")}
          </Button>
        </ScrollReveal>
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-8 sm:px-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c, i) => {
            const Icon = c.icon
            return (
              <ScrollReveal key={c.key} delay={i * 90}>
                <Card
                  role="button"
                  tabIndex={0}
                  onClick={() => goVerify(c.key)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && goVerify(c.key)}
                  className="group h-full cursor-pointer p-6 text-left transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg focus:outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="h-7 w-7" />
                  </span>
                  <h3 className="mt-4 font-display text-lg font-bold">{c.title}</h3>
                  <p className="mt-1 text-base text-muted-foreground">{c.desc}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                    {t("start")} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </Card>
              </ScrollReveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
