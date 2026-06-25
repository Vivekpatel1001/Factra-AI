import { useState } from "react"
import { useLocation } from "react-router-dom"
import VerifyDashboard from "../components/VerifyDashboard.jsx"
import LoadingSteps from "../components/LoadingSteps.jsx"
import ResultCard from "../components/ResultCard.jsx"
import { getMockResult } from "../lib/mockData.js"
import { useApp } from "../context/AppContext.jsx"

export default function VerifyPage() {
  const { t } = useApp()
  const location = useLocation()
  const initialTab = location.state?.tab || "text"

  const [stage, setStage] = useState("input") // input | loading | result
  const [result, setResult] = useState(null)
  const [pendingRequest, setPendingRequest] = useState({ type: "text", content: {} })

  const handleCheck = (request) => {
    setPendingRequest(request)
    setStage("loading")
  }

  const handleDone = () => {
    setResult(getMockResult(pendingRequest.type, t, pendingRequest.content))
    setStage("result")
  }

  const handleReset = () => {
    setResult(null)
    setStage("input")
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      {stage === "input" && (
        <VerifyDashboard initialTab={initialTab} onCheck={handleCheck} />
      )}

      {stage === "loading" && <LoadingSteps onDone={handleDone} />}

      {stage === "result" && result && <ResultCard result={result} onReset={handleReset} />}
    </div>
  )
}
