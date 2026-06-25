import InputTabs from "./InputTabs.jsx"
import ScrollReveal from "./ScrollReveal.jsx"
import { useApp } from "../context/AppContext.jsx"

export default function VerifyDashboard({ initialTab, onCheck }) {
  const { t } = useApp()

  return (
    <>
      <ScrollReveal className="text-center">
        <h1 className="text-balance font-display text-3xl font-extrabold sm:text-4xl">
          {t("verify_title")}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
          {t("verify_subtitle")}
        </p>
      </ScrollReveal>
      <ScrollReveal delay={120} className="mt-8">
        <InputTabs initialTab={initialTab} onCheck={onCheck} />
      </ScrollReveal>
    </>
  )
}
