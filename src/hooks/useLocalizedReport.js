import { useEffect, useRef, useState } from "react"
import { translateReportResult } from "../lib/api.js"
import { applyReportShell, localizeReportInstant, reportCacheKey, resolveSourceLanguage } from "../lib/localizeReport.js"
import { useApp } from "../context/AppContext.jsx"

export function useLocalizedReport(sourceResult) {
  const { language, t } = useApp()
  const [displayResult, setDisplayResult] = useState(null)
  const [localizing, setLocalizing] = useState(false)
  const cacheRef = useRef(new Map())

  useEffect(() => {
    if (!sourceResult) {
      setDisplayResult(null)
      setLocalizing(false)
      return undefined
    }

    const sourceLanguage = resolveSourceLanguage(sourceResult)
    const normalizedSource = { ...sourceResult, language: sourceLanguage }
    const cacheKey = reportCacheKey(sourceResult, language)
    const cached = cacheRef.current.get(cacheKey)

    if (cached) {
      setDisplayResult(cached)
      setLocalizing(false)
      return undefined
    }

    if (sourceLanguage === language) {
      const shell = { ...applyReportShell(normalizedSource, t), language }
      setDisplayResult(shell)
      setLocalizing(false)
      cacheRef.current.set(cacheKey, shell)
      return undefined
    }

    const instant = localizeReportInstant(normalizedSource, language, t)
    setDisplayResult(instant)

    let cancelled = false
    setLocalizing(true)

    translateReportResult({ result: normalizedSource, language })
      .then((data) => {
        if (cancelled) return
        const localized = { ...data.result, language }
        cacheRef.current.set(cacheKey, localized)
        setDisplayResult(localized)
      })
      .catch(() => {
        if (!cancelled) setDisplayResult(instant)
      })
      .finally(() => {
        if (!cancelled) setLocalizing(false)
      })

    return () => {
      cancelled = true
    }
  }, [sourceResult, language])

  return { displayResult, localizing }
}
