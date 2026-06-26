import { createContext, useContext, useEffect, useState } from "react"
import { getAuthToken, getMe, logout as apiLogout } from "../lib/api.js"
import { translations } from "../lib/translations.js"

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [language, setLanguage] = useState(() => localStorage.getItem("factra-language") || "en")
  const [largeFont, setLargeFont] = useState(false)
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(Boolean(getAuthToken()))

  useEffect(() => {
    const root = document.documentElement
    if (largeFont) root.classList.add("large-font")
    else root.classList.remove("large-font")
  }, [largeFont])

  useEffect(() => {
    document.documentElement.lang = language
    localStorage.setItem("factra-language", language)
  }, [language])

  useEffect(() => {
    let active = true
    async function loadUser() {
      if (!getAuthToken()) {
        setAuthLoading(false)
        return
      }
      try {
        const data = await getMe()
        if (active) setUser(data.user)
      } catch {
        if (active) setUser(null)
      } finally {
        if (active) setAuthLoading(false)
      }
    }
    loadUser()
    return () => {
      active = false
    }
  }, [])

  const t = (key) => {
    const dict = translations[language] || translations.en
    return dict[key] ?? translations.en[key] ?? key
  }

  const logout = async () => {
    try {
      await apiLogout()
    } finally {
      setUser(null)
    }
  }

  return (
    <AppContext.Provider
      value={{
        language,
        setLanguage,
        largeFont,
        setLargeFont,
        toggleFont: () => setLargeFont((v) => !v),
        t,
        user,
        setUser,
        authLoading,
        isAuthenticated: Boolean(user),
        logout,
      }}
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
