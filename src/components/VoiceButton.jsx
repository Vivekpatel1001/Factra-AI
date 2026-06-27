import { useEffect, useRef, useState } from "react"
import { Mic, MicOff } from "lucide-react"
import { useApp } from "../context/AppContext.jsx"

const langMap = { en: "en-IN", hi: "hi-IN", gu: "gu-IN" }

export default function VoiceButton({ onResult }) {
  const { t, language } = useApp()
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(true)
  const recRef = useRef(null)
  const onResultRef = useRef(onResult)
  const shouldListenRef = useRef(false)
  const startingRef = useRef(false)

  useEffect(() => {
    onResultRef.current = onResult
  }, [onResult])

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      setSupported(false)
      return
    }
    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.maxAlternatives = 1
    rec.onresult = (e) => {
      let finalText = ""
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const result = e.results[i]
        if (result.isFinal) finalText += `${result[0]?.transcript || ""} `
      }
      finalText = finalText.replace(/\s+/g, " ").trim()
      if (finalText) onResultRef.current?.(finalText)
    }
    rec.onstart = () => {
      startingRef.current = false
      setListening(true)
    }
    rec.onend = () => {
      startingRef.current = false
      if (!shouldListenRef.current) {
        setListening(false)
        return
      }
      setListening(false)
      window.setTimeout(() => {
        if (!shouldListenRef.current || startingRef.current) return
        try {
          rec.lang = langMap[language] || "en-IN"
          startingRef.current = true
          rec.start()
        } catch {
          startingRef.current = false
          setListening(false)
        }
      }, 250)
    }
    rec.onerror = (event) => {
      startingRef.current = false
      if (event.error === "no-speech" && shouldListenRef.current) return
      shouldListenRef.current = false
      setListening(false)
    }
    recRef.current = rec
    return () => {
      shouldListenRef.current = false
      rec.abort?.()
    }
  }, [language])

  const toggle = () => {
    const rec = recRef.current
    if (!rec) return
    if (listening) {
      shouldListenRef.current = false
      rec.stop()
      setListening(false)
    } else {
      rec.lang = langMap[language] || "en-IN"
      try {
        shouldListenRef.current = true
        startingRef.current = true
        rec.start()
        setListening(true)
      } catch {
        shouldListenRef.current = false
        startingRef.current = false
        setListening(false)
      }
    }
  }

  if (!supported) return null

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={listening}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-base font-semibold transition-colors ${
        listening
          ? "animate-pulse-ring border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground hover:bg-muted"
      }`}
    >
      {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
      {listening ? t("listen_speak") : t("voice_input")}
    </button>
  )
}
