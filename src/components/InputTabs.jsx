import { useState } from "react"
import { MessageSquareText, Link2, Image as ImageIcon, Video, ShieldCheck, Info } from "lucide-react"
import Button from "./ui/Button.jsx"
import Card from "./ui/Card.jsx"
import UploadBox from "./UploadBox.jsx"
import VoiceButton from "./VoiceButton.jsx"
import { useApp } from "../context/AppContext.jsx"

export default function InputTabs({ initialTab = "text", onCheck }) {
  const { t } = useApp()
  const [tab, setTab] = useState(initialTab)
  const [text, setText] = useState("")
  const [link, setLink] = useState("")
  const [error, setError] = useState("")

  const tabs = [
    { key: "text", label: t("tab_text"), icon: MessageSquareText },
    { key: "link", label: t("tab_link"), icon: Link2 },
    { key: "image", label: t("tab_image"), icon: ImageIcon },
    { key: "video", label: t("tab_video"), icon: Video },
  ]

  const handleCheck = () => {
    if (tab === "text" && !text.trim()) {
      setError(t("error_text_required"))
      return
    }
    if (tab === "link" && !link.trim()) {
      setError(t("error_link_required"))
      return
    }
    setError("")
    onCheck?.(tab)
  }

  return (
    <Card className="p-4 sm:p-6">
      {/* Tabs */}
      <div
        role="tablist"
        aria-label={t("choose_what_check")}
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {tabs.map((ti) => {
          const Icon = ti.icon
          const active = tab === ti.key
          return (
            <button
              key={ti.key}
              role="tab"
              aria-selected={active}
              onClick={() => {
                setTab(ti.key)
                setError("")
              }}
              className={`flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-base font-semibold transition-colors ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-muted"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{ti.label}</span>
            </button>
          )
        })}
      </div>

      {/* Panels */}
      <div className="mt-6">
        {tab === "text" && (
          <div>
            <label htmlFor="claim" className="mb-2 block text-lg font-semibold">
              {t("label_text")}
            </label>
            <textarea
              id="claim"
              rows={5}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("ph_text")}
              className="w-full resize-none rounded-2xl border border-input bg-background px-4 py-4 text-lg leading-relaxed focus:outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
            />
            <div className="mt-3">
              <VoiceButton onResult={(v) => setText((prev) => (prev ? prev + " " + v : v))} />
            </div>
          </div>
        )}

        {tab === "link" && (
          <div>
            <label htmlFor="link" className="mb-2 block text-lg font-semibold">
              {t("label_link")}
            </label>
            <input
              id="link"
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder={t("ph_link")}
              className="w-full rounded-2xl border border-input bg-background px-4 py-4 text-lg focus:outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
            />
          </div>
        )}

        {tab === "image" && (
          <div>
            <p className="mb-2 text-lg font-semibold">{t("label_image")}</p>
            <UploadBox accept="image/*" icon={ImageIcon} />
            <p className="mt-3 flex items-center gap-2 text-base text-muted-foreground">
              <Info className="h-5 w-5 shrink-0 text-primary" />
              {t("help_image")}
            </p>
          </div>
        )}

        {tab === "video" && (
          <div>
            <p className="mb-2 text-lg font-semibold">{t("label_video")}</p>
            <UploadBox accept="video/*" icon={Video} />
            <p className="mt-3 flex items-center gap-2 text-base text-muted-foreground">
              <Info className="h-5 w-5 shrink-0 text-primary" />
              {t("help_video")}
            </p>
          </div>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-2xl bg-[var(--color-false-soft)] px-4 py-3 text-base font-medium text-[var(--color-false)]"
        >
          {error}
        </p>
      )}

      <Button size="xl" className="mt-6 w-full" onClick={handleCheck}>
        <ShieldCheck className="h-6 w-6" /> {t("check_truth")}
      </Button>
    </Card>
  )
}
