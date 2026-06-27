import { useEffect, useState } from "react"
import { useLocation } from "react-router-dom"
import VerifyDashboard from "../components/VerifyDashboard.jsx"
import LoadingSteps from "../components/LoadingSteps.jsx"
import ResultCard from "../components/ResultCard.jsx"
import { verifyContent } from "../lib/api.js"
import { useApp } from "../context/AppContext.jsx"

export default function VerifyPage() {
  const location = useLocation()
  const { isAuthenticated } = useApp()
  const initialTab = location.state?.tab || "text"

  const [stage, setStage] = useState("input") // input | loading | result
  const [result, setResult] = useState(null)
  const [error, setError] = useState("")
  const [loadingType, setLoadingType] = useState("text")

  useEffect(() => {
    if (location.state?.savedResult) {
      setResult(location.state.savedResult)
      setStage("result")
    }
  }, [location.state])

  const handleCheck = async (request) => {
    setError("")
    setResult(null)
    setLoadingType(request.type || "text")
    setStage("loading")

    try {
      const data = await verifyContent(request)
      setResult(data.result)
      setStage("result")
    } catch (err) {
      setError(err.message || "Verification failed. Please try again.")
      setStage("input")
    }
  }

  const handleReset = () => {
    setResult(null)
    setError("")
    setStage("input")
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      {error && (
        <p className="mb-5 rounded-2xl bg-[var(--color-false-soft)] px-4 py-3 text-base font-semibold text-[var(--color-false)]">
          {error}
        </p>
      )}

      {stage === "input" && <>
          {!isAuthenticated && (
            <div className="mb-6 rounded-2xl border border-border bg-primary-soft px-5 py-4 text-sm font-semibold text-primary">
              Log in or create an account before checking if you want this result saved in your history.
            </div>
          )}
          <VerifyDashboard initialTab={initialTab} onCheck={handleCheck} />
        </>}

      {stage === "loading" && <LoadingSteps type={loadingType} />}

      {stage === "result" && result && <ResultCard result={result} onReset={handleReset} />}
    </div>
  )
}
