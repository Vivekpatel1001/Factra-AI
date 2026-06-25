import { useNavigate } from "react-router-dom"
import { ArrowRight } from "lucide-react"
import HeroSection from "../components/HeroSection.jsx"
import ProblemSection from "../components/ProblemSection.jsx"
import HowItWorks from "../components/HowItWorks.jsx"
import FeatureGrid from "../components/FeatureGrid.jsx"
import AboutSection from "../components/AboutSection.jsx"
import VideoTimeline from "../components/VideoTimeline.jsx"
import Button from "../components/ui/Button.jsx"
import Card from "../components/ui/Card.jsx"
import ScrollReveal from "../components/ScrollReveal.jsx"
import { useApp } from "../context/AppContext.jsx"
import { getMockResult } from "../lib/mockData.js"

export default function LandingPage() {
  const { t } = useApp()
  const navigate = useNavigate()
  const videoResult = getMockResult("video", t)

  return (
    <div>
      <HeroSection />
      <ProblemSection />

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <ScrollReveal direction="zoom">
          <Card glass className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <span className="inline-flex rounded-full bg-primary-soft px-4 py-1.5 text-sm font-semibold text-primary">
                {t("verify_dashboard_badge")}
              </span>
              <h2 className="mt-4 break-words font-display text-3xl font-extrabold sm:text-4xl">
                {t("verify_dashboard_title")}
              </h2>
              <p className="mt-3 max-w-2xl break-words text-lg leading-relaxed text-muted-foreground">
                {t("verify_dashboard_desc")}
              </p>
            </div>
            <Button size="xl" className="w-full lg:w-auto" onClick={() => navigate("/verify")}>
              {t("check_truth")} <ArrowRight className="h-5 w-5" />
            </Button>
          </Card>
        </ScrollReveal>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <ScrollReveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance font-display text-3xl font-extrabold sm:text-4xl">
            {t("video_reel_title")}
          </h2>
          <p className="mt-3 text-pretty text-lg text-muted-foreground">{t("video_reel_desc")}</p>
        </ScrollReveal>
        <ScrollReveal delay={120} className="mx-auto mt-10 max-w-3xl">
          <Card className="p-6 sm:p-8">
            <VideoTimeline items={videoResult.timeline} />
          </Card>
        </ScrollReveal>
      </section>

      <HowItWorks id="how-it-works" />
      <FeatureGrid />
      <AboutSection />

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
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
