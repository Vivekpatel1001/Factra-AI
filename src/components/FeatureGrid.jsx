import { BadgeCheck, FileText, Image, Link2, ShieldCheck, Video } from "lucide-react"
import Card from "./ui/Card.jsx"
import ScrollReveal from "./ScrollReveal.jsx"
import { useApp } from "../context/AppContext.jsx"

const features = [
  { icon: FileText, titleKey: "feature_text_title", descKey: "feature_text_desc" },
  { icon: Link2, titleKey: "feature_link_title", descKey: "feature_link_desc" },
  { icon: Image, titleKey: "feature_image_title", descKey: "feature_image_desc" },
  { icon: Video, titleKey: "feature_video_title", descKey: "feature_video_desc" },
  { icon: ShieldCheck, titleKey: "feature_score_title", descKey: "feature_score_desc" },
  { icon: BadgeCheck, titleKey: "feature_evidence_title", descKey: "feature_evidence_desc" },
]

export default function FeatureGrid() {
  const { t } = useApp()
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <ScrollReveal className="mx-auto max-w-2xl text-center">
        <span className="inline-flex rounded-full bg-primary-soft px-4 py-1.5 text-sm font-semibold text-primary">
          {t("features_badge")}
        </span>
        <h2 className="mt-4 text-balance font-display text-3xl font-extrabold sm:text-4xl">{t("features_title")}</h2>
      </ScrollReveal>
      <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {features.map((feature, i) => {
          const Icon = feature.icon
          return (
            <ScrollReveal key={feature.titleKey} delay={i * 70}>
              <Card className="h-full p-6">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="mt-4 break-words font-display text-lg font-bold">{t(feature.titleKey)}</h3>
                <p className="mt-2 break-words text-base leading-relaxed text-muted-foreground">{t(feature.descKey)}</p>
              </Card>
            </ScrollReveal>
          )
        })}
      </div>
    </section>
  )
}
