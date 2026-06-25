import { ShieldCheck } from "lucide-react"
import Card from "./ui/Card.jsx"
import ScrollReveal from "./ScrollReveal.jsx"
import { useApp } from "../context/AppContext.jsx"

export default function AboutSection() {
  const { t } = useApp()
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <ScrollReveal direction="zoom">
        <Card glass className="grid gap-6 p-8 sm:p-10 md:grid-cols-[auto_1fr] md:items-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <ShieldCheck className="h-8 w-8" />
          </span>
          <div>
            <h2 className="break-words font-display text-3xl font-extrabold">{t("about_short_title")}</h2>
            <p className="mt-3 max-w-3xl break-words text-lg leading-relaxed text-muted-foreground">
              {t("about_short_desc")}
            </p>
          </div>
        </Card>
      </ScrollReveal>
    </section>
  )
}
