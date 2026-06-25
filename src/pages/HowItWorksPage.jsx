import { useNavigate } from "react-router-dom"
import { ArrowRight } from "lucide-react"
import HowItWorks from "../components/HowItWorks.jsx"
import Button from "../components/ui/Button.jsx"
import ScrollReveal from "../components/ScrollReveal.jsx"
import { useApp } from "../context/AppContext.jsx"

export default function HowItWorksPage() {
  const { t } = useApp()
  const navigate = useNavigate()
  return (
    <div>
      <ScrollReveal className="mx-auto max-w-3xl px-4 pt-14 pb-2 text-center sm:px-6">
        <h1 className="text-balance font-display text-4xl font-extrabold sm:text-5xl">
          {t("how_it_works")}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
          {t("how_page_subtitle")}
        </p>
      </ScrollReveal>
      <HowItWorks />
      <ScrollReveal className="mx-auto max-w-6xl px-4 pb-8 text-center sm:px-6">
        <Button size="xl" onClick={() => navigate("/verify")}>
          {t("verify_now")} <ArrowRight className="h-5 w-5" />
        </Button>
      </ScrollReveal>
    </div>
  )
}
