import { createContext, useContext, useEffect, useState } from "react"
import { translations } from "../lib/translations.js"

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [language, setLanguage] = useState(() => localStorage.getItem("factra-language") || "en")
  const [largeFont, setLargeFont] = useState(false)

  useEffect(() => {
    const root = document.documentElement
    if (largeFont) root.classList.add("large-font")
    else root.classList.remove("large-font")
  }, [largeFont])

  useEffect(() => {
    document.documentElement.lang = language
    localStorage.setItem("factra-language", language)
  }, [language])

  const t = (key) => {
    const dict = translations[language] || translations.en
    return dict[key] ?? translations.en[key] ?? key
  }

  return (
    <AppContext.Provider
      value={{ language, setLanguage, largeFont, setLargeFont, toggleFont: () => setLargeFont((v) => !v), t }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error("useApp must be used within AppProvider")
  return ctx
}
