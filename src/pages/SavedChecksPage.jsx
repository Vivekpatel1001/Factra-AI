import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ArrowRight, FileText, LogIn, Trash2 } from "lucide-react"
import Button from "../components/ui/Button.jsx"
import Card from "../components/ui/Card.jsx"
import TrustScore from "../components/TrustScore.jsx"
import { deleteReport, getReports } from "../lib/api.js"
import { getVerdict } from "../lib/verdicts.js"
import { useApp } from "../context/AppContext.jsx"

export default function SavedChecksPage() {
  const { t, isAuthenticated } = useApp()
  const navigate = useNavigate()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [deletingId, setDeletingId] = useState("")

  useEffect(() => {
    let active = true
    async function loadReports() {
      if (!isAuthenticated) {
        setLoading(false)
        return
      }
      setLoading(true)
      setError("")
      try {
        const data = await getReports()
        if (active) setReports(data.reports || [])
      } catch (err) {
        if (active) setError(err.message || "Could not load saved checks.")
      } finally {
        if (active) setLoading(false)
      }
    }
    loadReports()
    return () => {
      active = false
    }
  }, [isAuthenticated])

  const handleDelete = async (reportId) => {
    setDeletingId(reportId)
    setError("")
    try {
      await deleteReport(reportId)
      setReports((current) => current.filter((report) => report.id !== reportId))
    } catch (err) {
      setError(err.message || "Could not delete this report.")
    } finally {
      setDeletingId("")
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <Card className="p-8 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <LogIn className="h-7 w-7" />
          </span>
          <h1 className="mt-5 font-display text-3xl font-extrabold">Log in to save your checks</h1>
          <p className="mx-auto mt-3 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Create an account or log in before checking a claim. Factra will save your verdicts, evidence, and reports here.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Button size="lg" onClick={() => navigate("/login")}>Log in</Button>
            <Button variant="secondary" size="lg" onClick={() => navigate("/signup")}>Create account</Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-4xl font-extrabold">Saved checks</h1>
          <p className="mt-2 text-lg text-muted-foreground">Your saved fact-check history and evidence reports.</p>
        </div>
        <Button onClick={() => navigate("/verify")}>
          Check another <ArrowRight className="h-5 w-5" />
        </Button>
      </div>

      {loading && (
        <Card className="mt-8 p-6 text-center text-muted-foreground">Loading saved checks...</Card>
      )}

      {error && (
        <p className="mt-8 rounded-2xl bg-[var(--color-false-soft)] px-4 py-3 text-base font-semibold text-[var(--color-false)]">
          {error}
        </p>
      )}

      {!loading && !error && reports.length === 0 && (
        <Card className="mt-8 p-8 text-center">
          <FileText className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-3 font-display text-2xl font-bold">No saved checks yet</h2>
          <p className="mt-2 text-muted-foreground">Run a check while logged in and it will appear here.</p>
          <Button className="mt-5" onClick={() => navigate("/verify")}>Start checking</Button>
        </Card>
      )}

      <div className="mt-8 grid gap-4">
        {reports.map((report) => {
          const result = report.result || {}
          const verdict = getVerdict(result.verdict, t)
          return (
            <Card key={report.id} className="p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-sm font-bold ${verdict.chip}`}>{verdict.label}</span>
                    <span className="text-sm font-semibold text-muted-foreground">
                      {new Date(report.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-2 text-lg font-semibold">{result.claim}</p>
                  <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{result.meaning}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <TrustScore score={result.trustScore || 0} />
                  <Button variant="secondary" onClick={() => navigate("/verify", { state: { savedResult: result } })}>
                    View
                  </Button>
                  <Button
                    variant="ghost"
                    aria-label="Delete report"
                    onClick={() => handleDelete(report.id)}
                    disabled={deletingId === report.id}
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-background p-5 text-sm leading-relaxed text-muted-foreground">
        <p className="font-semibold text-foreground">How saving works</p>
        <p className="mt-1">When you are logged in, each verification is saved with its claim, verdict, trust score, evidence, and generated report data.</p>
      </div>
    </div>
  )
}
