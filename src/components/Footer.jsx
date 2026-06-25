import { Link } from "react-router-dom"
import { ShieldCheck, Heart } from "lucide-react"
import { useApp } from "../context/AppContext.jsx"

export default function Footer() {
  const { t } = useApp()
  return (
    <footer className="mt-20 border-t border-border bg-card">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <ShieldCheck className="h-6 w-6" />
              </span>
              <span className="font-display text-xl font-extrabold">Factra AI</span>
            </div>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              {t("footer_desc")}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="font-display text-base font-bold">{t("pages")}</h3>
            <Link to="/" className="text-muted-foreground hover:text-foreground">
              {t("nav_home")}
            </Link>
            <Link to="/verify" className="text-muted-foreground hover:text-foreground">
              {t("nav_verify")}
            </Link>
            <Link to="/how-it-works" className="text-muted-foreground hover:text-foreground">
              {t("nav_how")}
            </Link>
            <Link to="/about" className="text-muted-foreground hover:text-foreground">
              {t("nav_about")}
            </Link>
          </div>

          <div className="max-w-xs text-base leading-relaxed text-muted-foreground md:text-right">
            {t("footer_tagline")}
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row">
          <p>{"\u00A9"} {new Date().getFullYear()} Factra AI. {t("stay_safe_online")}</p>
          <p className="flex items-center gap-1">
            {t("made_with")} <Heart className="h-4 w-4 text-[var(--color-false)]" /> {t("for_safer_sharing")}
          </p>
        </div>
      </div>
    </footer>
  )
}
