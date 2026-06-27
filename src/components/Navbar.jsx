import { useState } from "react"
import { Link, NavLink, useNavigate } from "react-router-dom"
import { ShieldCheck, Menu, X, Type, Globe, LogOut } from "lucide-react"
import Button from "./ui/Button.jsx"
import { useApp } from "../context/AppContext.jsx"
import { languages } from "../lib/translations.js"

export default function Navbar() {
  const { t, language, setLanguage, largeFont, toggleFont, isAuthenticated, user, logout } = useApp()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  const links = [
    { to: "/", label: t("nav_home") },
    { to: "/verify", label: t("nav_verify") },
    { to: "/how-it-works", label: t("nav_how") },
    { to: "/about", label: t("nav_about") },
    ...(isAuthenticated ? [{ to: "/saved", label: t("nav_saved") }] : []),
  ]

  const linkClass = ({ isActive }) =>
    `rounded-full px-4 py-2 text-base font-medium transition-colors ${
      isActive ? "bg-primary-soft text-primary" : "text-muted-foreground hover:text-foreground"
    }`

  const handleLogout = async () => {
    await logout()
    setOpen(false)
    navigate("/")
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <span className="font-display text-xl font-extrabold tracking-tight">Factra AI</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkClass} end={l.to === "/"}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="relative hidden items-center sm:flex">
            <Globe className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
            <select
              aria-label={t("choose_language")}
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="appearance-none rounded-full border border-border bg-card py-2 pl-9 pr-4 text-sm font-medium text-foreground focus:outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
            >
              {languages.map((lang) => (
                <option key={lang.code} value={lang.code}>{lang.label}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={toggleFont}
            aria-pressed={largeFont}
            title={t("large_font")}
            className={`hidden h-10 w-10 items-center justify-center rounded-full border transition-colors sm:flex ${
              largeFont ? "border-primary bg-primary-soft text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            <Type className="h-5 w-5" />
            <span className="sr-only">{t("large_font")}</span>
          </button>

          {isAuthenticated ? (
            <>
              <Button className="hidden sm:inline-flex" variant="secondary" onClick={() => navigate("/saved")}>{t("nav_saved")}</Button>
              <button
                type="button"
                onClick={handleLogout}
                title={`${t("signed_in_as")} ${user?.name || user?.email}`}
                className="hidden h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground sm:flex"
              >
                <LogOut className="h-5 w-5" />
                <span className="sr-only">{t("logout")}</span>
              </button>
            </>
          ) : (
            <>
              <Button className="hidden sm:inline-flex" variant="secondary" onClick={() => navigate("/login")}>{t("login")}</Button>
              <Button className="hidden sm:inline-flex" onClick={() => navigate("/signup")}>{t("signup")}</Button>
            </>
          )}

          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? t("close_menu") : t("open_menu")}
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border bg-card px-4 py-4 lg:hidden">
          <nav className="flex flex-col gap-1">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.to === "/"} onClick={() => setOpen(false)} className={linkClass}>
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-4 flex items-center gap-3">
            <select
              aria-label={t("choose_language")}
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="flex-1 rounded-full border border-border bg-background py-3 px-4 text-base font-medium"
            >
              {languages.map((lang) => (
                <option key={lang.code} value={lang.code}>{lang.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={toggleFont}
              aria-pressed={largeFont}
              className={`flex items-center gap-2 rounded-full border px-4 py-3 text-base font-medium ${
                largeFont ? "border-primary bg-primary-soft text-primary" : "border-border bg-background"
              }`}
            >
              <Type className="h-5 w-5" /> {t("large_font")}
            </button>
          </div>
          {isAuthenticated ? (
            <Button className="mt-4 w-full" variant="secondary" size="lg" onClick={handleLogout}>{t("logout")}</Button>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Button variant="secondary" size="lg" onClick={() => { setOpen(false); navigate("/login") }}>{t("login")}</Button>
              <Button size="lg" onClick={() => { setOpen(false); navigate("/signup") }}>{t("signup")}</Button>
            </div>
          )}
          <Button className="mt-4 w-full" size="lg" onClick={() => { setOpen(false); navigate("/verify") }}>
            {t("verify_now")}
          </Button>
        </div>
      )}
    </header>
  )
}
