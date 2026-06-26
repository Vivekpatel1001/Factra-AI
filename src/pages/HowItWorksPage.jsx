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
            <h2 className="font-display text-3xl font-extrabold">AI and evidence setup</h2>
            <p className="mt-2 max-w-3xl text-lg leading-relaxed text-muted-foreground">
              Factra uses retrieval first, then Gemini. That means the model should judge claims from collected evidence instead of guessing from memory.
            </p>
          </div>
        </ScrollReveal>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-5">
            <SearchCheck className="h-8 w-8 text-primary" />
            <h3 className="mt-3 font-display text-xl font-bold">Trusted search evidence</h3>
            <p className="mt-2 text-base leading-relaxed text-muted-foreground">
              Serper, NewsAPI, and NewsData collect public evidence. The backend then sends the claim plus selected evidence to Gemini for verdict, explanation, and score.
            </p>
          </Card>
          <Card className="p-5">
            <Database className="h-8 w-8 text-primary" />
            <h3 className="mt-3 font-display text-xl font-bold">Vector retrieval</h3>
            <p className="mt-2 text-base leading-relaxed text-muted-foreground">
              The current app uses a JavaScript vector ranking layer to choose the most relevant evidence. This is enough for the hackathon/demo workflow and keeps setup simple.
            </p>
          </Card>
          <Card className="p-5">
            <Brain className="h-8 w-8 text-primary" />
            <h3 className="mt-3 font-display text-xl font-bold">Gemini reasoning</h3>
            <p className="mt-2 text-base leading-relaxed text-muted-foreground">
              Gemini classifies only from the evidence it receives: True, False, Misleading, or Unverified. This is a RAG-style fact-checking flow.
            </p>
          </Card>
          <Card className="p-5">
            <GraduationCap className="h-8 w-8 text-primary" />
            <h3 className="mt-3 font-display text-xl font-bold">Training is optional</h3>
            <p className="mt-2 text-base leading-relaxed text-muted-foreground">
              You do not need to train a model now. Fine-tuning is useful later for a custom verdict style, strong local-language behavior, or a large private fact-check dataset.
            </p>
          </Card>
        </div>
        <Card className="mt-4 p-5">
          <h3 className="font-display text-xl font-bold">FAISS upgrade path</h3>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            Real FAISS is best as a Python/native backend service with persistent embeddings. The current JS vector layer is intentionally lightweight; when you need persistent large-scale retrieval, add a Python FAISS microservice and call it from the Node backend.
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
