import { Link } from "react-router-dom"
import { ArrowRight, Lock, Mail, ShieldCheck, UserRound } from "lucide-react"
import Button from "../components/ui/Button.jsx"
import Card from "../components/ui/Card.jsx"
import ScrollReveal from "../components/ScrollReveal.jsx"
import { useApp } from "../context/AppContext.jsx"

export default function AuthPage({ mode = "login" }) {
  const { t } = useApp()
  const isSignup = mode === "signup"
  const benefits = ["auth_benefit_1", "auth_benefit_2", "auth_benefit_3"]

  return (
    <div className="mx-auto grid min-h-[calc(100vh-9rem)] max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_0.9fr]">
      <ScrollReveal direction="left" className="max-w-xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-primary">
          <ShieldCheck className="h-4 w-4" />
          {t("auth_badge")}
        </span>
        <h1 className="mt-5 text-balance font-display text-4xl font-extrabold leading-tight sm:text-5xl">
          {isSignup ? t("signup_hero_title") : t("login_hero_title")}
        </h1>
        <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
          {isSignup ? t("signup_hero_desc") : t("login_hero_desc")}
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {benefits.map((item, i) => (
            <ScrollReveal key={item} delay={i * 80}>
              <div className="rounded-2xl border border-border bg-card/80 p-4">
                <p className="font-display text-2xl font-extrabold text-primary">0{i + 1}</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{t(item)}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </ScrollReveal>

      <ScrollReveal direction="right" delay={120}>
        <Card className="p-6 sm:p-8">
          <div className="mb-7">
            <h2 className="font-display text-2xl font-bold">{isSignup ? t("create_account") : t("login")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isSignup ? t("signup_form_desc") : t("login_form_desc")}
            </p>
          </div>

          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            {isSignup && (
              <label className="block">
                <span className="text-sm font-semibold text-muted-foreground">{t("full_name")}</span>
                <span className="mt-2 flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 focus-within:ring-4 focus-within:ring-ring/30">
                  <UserRound className="h-5 w-5 text-muted-foreground" />
                  <input
                    type="text"
                    name="name"
                    autoComplete="name"
                    className="w-full bg-transparent text-base outline-none"
                    placeholder={t("your_name")}
                  />
                </span>
              </label>
            )}

            <label className="block">
              <span className="text-sm font-semibold text-muted-foreground">{t("email_address")}</span>
              <span className="mt-2 flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 focus-within:ring-4 focus-within:ring-ring/30">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  className="w-full bg-transparent text-base outline-none"
                  placeholder="you@example.com"
                />
              </span>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-muted-foreground">{t("password")}</span>
              <span className="mt-2 flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 focus-within:ring-4 focus-within:ring-ring/30">
                <Lock className="h-5 w-5 text-muted-foreground" />
                <input
                  type="password"
                  name="password"
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  className="w-full bg-transparent text-base outline-none"
                  placeholder={t("enter_password")}
                />
              </span>
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <label className="inline-flex items-center gap-2 text-muted-foreground">
                <input type="checkbox" className="h-4 w-4 rounded border-border accent-primary" />
                {t("remember_me")}
              </label>
              {!isSignup && (
                <Link to="/signup" className="font-semibold text-primary hover:brightness-125">
                  {t("forgot_password")}
                </Link>
              )}
            </div>

            <Button type="submit" size="lg" className="w-full">
              {isSignup ? t("create_account") : t("login")}
              <ArrowRight className="h-5 w-5" />
            </Button>
          </form>

          <div className="mt-6 border-t border-border pt-6 text-center text-sm text-muted-foreground">
            {isSignup ? t("already_have_account") : t("new_to_factra")}{" "}
            <Link to={isSignup ? "/login" : "/signup"} className="font-semibold text-primary hover:brightness-125">
              {isSignup ? t("login") : t("create_account")}
            </Link>
          </div>
        </Card>
      </ScrollReveal>
    </div>
  )
}
