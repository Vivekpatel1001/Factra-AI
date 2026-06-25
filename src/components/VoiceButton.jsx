import { useEffect, useRef, useState } from "react"
import { Mic, MicOff } from "lucide-react"
import { useApp } from "../context/AppContext.jsx"

const langMap = { en: "en-IN", hi: "hi-IN", gu: "gu-IN" }

export default function VoiceButton({ onResult }) {
  const { t, language } = useApp()
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(true)
  const recRef = useRef(null)

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      setSupported(false)
      return
    }
    const rec = new SR()
    rec.continuous = false
    rec.interimResults = false
    rec.onresult = (e) => {
      const text = e.results?.[0]?.[0]?.transcript || ""
      onResult?.(text)
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    recRef.current = rec
    return () => rec.abort?.()
  }, [onResult])

  const toggle = () => {
    const rec = recRef.current
    if (!rec) return
    if (listening) {
      rec.stop()
      setListening(false)
    } else {
      rec.lang = langMap[language] || "en-IN"
      try {
        rec.start()
        setListening(true)
      } catch {
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
