import { useNavigate } from "react-router-dom"
import { ArrowRight, Brain, Database, GraduationCap, SearchCheck } from "lucide-react"
import HowItWorks from "../components/HowItWorks.jsx"
import Button from "../components/ui/Button.jsx"
import Card from "../components/ui/Card.jsx"
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

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <ScrollReveal>
          <div className="mb-5">
            <h2 className="font-display text-3xl font-extrabold">{t("how_ai_title")}</h2>
            <p className="mt-2 max-w-3xl text-lg leading-relaxed text-muted-foreground">
              {t("how_ai_desc")}
            </p>
          </div>
        </ScrollReveal>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-5">
            <SearchCheck className="h-8 w-8 text-primary" />
            <h3 className="mt-3 font-display text-xl font-bold">{t("how_trusted_search_title")}</h3>
            <p className="mt-2 text-base leading-relaxed text-muted-foreground">
              {t("how_trusted_search_desc")}
            </p>
          </Card>
          <Card className="p-5">
            <Database className="h-8 w-8 text-primary" />
            <h3 className="mt-3 font-display text-xl font-bold">{t("how_vector_title")}</h3>
            <p className="mt-2 text-base leading-relaxed text-muted-foreground">
              {t("how_vector_desc")}
            </p>
          </Card>
          <Card className="p-5">
            <Brain className="h-8 w-8 text-primary" />
            <h3 className="mt-3 font-display text-xl font-bold">{t("how_gemini_title")}</h3>
            <p className="mt-2 text-base leading-relaxed text-muted-foreground">
              {t("how_gemini_desc")}
            </p>
          </Card>
          <Card className="p-5">
            <GraduationCap className="h-8 w-8 text-primary" />
            <h3 className="mt-3 font-display text-xl font-bold">{t("how_training_title")}</h3>
            <p className="mt-2 text-base leading-relaxed text-muted-foreground">
              {t("how_training_desc")}
            </p>
          </Card>
        </div>
        <Card className="mt-4 p-5">
          <h3 className="font-display text-xl font-bold">{t("how_faiss_title")}</h3>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            {t("how_faiss_desc")}
          </p>
        </Card>
      </section>

      <ScrollReveal className="mx-auto max-w-6xl px-4 pb-8 text-center sm:px-6">
        <Button size="xl" onClick={() => navigate("/verify")}>
          {t("verify_now")} <ArrowRight className="h-5 w-5" />
        </Button>
      </ScrollReveal>
    </div>
  )
}
