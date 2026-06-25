import { useState } from "react"
import { useLocation } from "react-router-dom"
import InputTabs from "../components/InputTabs.jsx"
import LoadingSteps from "../components/LoadingSteps.jsx"
import ResultCard from "../components/ResultCard.jsx"
import ScrollReveal from "../components/ScrollReveal.jsx"
import { getMockResult } from "../lib/mockData.js"
import { useApp } from "../context/AppContext.jsx"

export default function VerifyPage() {
  const { t } = useApp()
  const location = useLocation()
  const initialTab = location.state?.tab || "text"

  const [stage, setStage] = useState("input") // input | loading | result
  const [result, setResult] = useState(null)
  const [pendingType, setPendingType] = useState("text")

  const handleCheck = (type) => {
    setPendingType(type)
    setStage("loading")
  }

  const handleDone = () => {
    setResult(getMockResult(pendingType, t))
    setStage("result")
  }

  const handleReset = () => {
    setResult(null)
    setStage("input")
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      {stage === "input" && (
        <>
          <ScrollReveal className="text-center">
            <h1 className="text-balance font-display text-3xl font-extrabold sm:text-4xl">
              {t("verify_title")}
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
              {t("verify_subtitle")}
            </p>
          </ScrollReveal>
          <ScrollReveal delay={120} className="mt-8">
            <InputTabs initialTab={initialTab} onCheck={handleCheck} />
          </ScrollReveal>
        </>
      )}

      {stage === "loading" && <LoadingSteps onDone={handleDone} />}

      {stage === "result" && result && <ResultCard result={result} onReset={handleReset} />}
    </div>
  )
}
