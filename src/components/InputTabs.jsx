import { useEffect, useState } from "react"
import { MessageSquareText, Link2, Image as ImageIcon, Video, ShieldCheck, Info, Loader2, FileText, WandSparkles } from "lucide-react"
import Button from "./ui/Button.jsx"
import Card from "./ui/Card.jsx"
import UploadBox from "./UploadBox.jsx"
import VoiceButton from "./VoiceButton.jsx"
import { useApp } from "../context/AppContext.jsx"

async function preprocessImage(file) {
  const bitmap = await createImageBitmap(file)
  const maxSide = Math.max(bitmap.width, bitmap.height)
  const scale = Math.min(3, Math.max(1.6, 2200 / maxSide))
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)

  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    let gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
    gray = Math.max(0, Math.min(255, (gray - 128) * 1.55 + 128))
    data[i] = gray
    data[i + 1] = gray
    data[i + 2] = gray
  }
  ctx.putImageData(imageData, 0, 0)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error("Could not prepare image for OCR."))
    }, "image/png")
  })
}

function cleanOcrText(value) {
  const lines = value
    .replace(/[|]{2,}/g, " ")
    .replace(/[ \t]+/g, " ")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)

  const cleaned = lines.filter((line, index) => {
    const nextLine = lines[index + 1] || ""
    const isLikelyLogoArtifact =
      index === 0 &&
      nextLine.length > 12 &&
      /^[A-Z]{1,4}\.?$/.test(line) &&
      !/[0-9]/.test(line)

    return !isLikelyLogoArtifact
  })

  return cleaned.join("\n").trim()
}

const demoTranscript = [
  "[00:12] Government is giving free money to everyone.",
  "[00:28] Register today using this link to claim your reward.",
  "[00:40] Share this with everyone before it is removed.",
].join("\n")

export default function InputTabs({ initialTab = "text", onCheck }) {
  const { t } = useApp()
  const [tab, setTab] = useState(initialTab)
  const [text, setText] = useState("")
  const [link, setLink] = useState("")
  const [imageFile, setImageFile] = useState(null)
  const [videoFile, setVideoFile] = useState(null)
  const [ocrText, setOcrText] = useState("")
  const [ocrStatus, setOcrStatus] = useState("idle")
  const [ocrProgress, setOcrProgress] = useState(0)
  const [ocrConfidence, setOcrConfidence] = useState(null)
  const [ocrLanguage, setOcrLanguage] = useState("eng")
  const [ocrError, setOcrError] = useState("")
  const [videoTranscript, setVideoTranscript] = useState("")
  const [videoPreviewUrl, setVideoPreviewUrl] = useState("")
  const [error, setError] = useState("")

  const tabs = [
    { key: "text", label: t("tab_text"), icon: MessageSquareText },
    { key: "link", label: t("tab_link"), icon: Link2 },
    { key: "image", label: t("tab_image"), icon: ImageIcon },
    { key: "video", label: t("tab_video"), icon: Video },
  ]

  useEffect(() => {
    return () => {
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl)
    }
  }, [videoPreviewUrl])

  const handleImageFile = async (file) => {
    setImageFile(file)
    setOcrText("")
    setOcrError("")
    setOcrProgress(0)
    setOcrConfidence(null)

    if (!file) {
      setOcrStatus("idle")
      return
    }

    await runImageOcr(file)
  }

  const runImageOcr = async (file = imageFile) => {
    if (!file) return
    setOcrText("")
    setOcrError("")
    setOcrProgress(0)
    setOcrConfidence(null)
    setOcrStatus("reading")
    try {
      const Tesseract = (await import("tesseract.js")).default
      const preparedImage = await preprocessImage(file)
      const result = await Tesseract.recognize(preparedImage, ocrLanguage, {
        tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
        preserve_interword_spaces: "1",
        logger: (message) => {
          if (message.status === "recognizing text") {
            setOcrProgress(Math.round((message.progress || 0) * 100))
          }
        },
      })
      const extracted = cleanOcrText(result.data.text)
      setOcrText(extracted)
      setOcrConfidence(Math.round(result.data.confidence || 0))
      setOcrStatus(extracted ? "done" : "empty")
      if (!extracted) setOcrError(t("ocr_empty"))
    } catch {
      setOcrStatus("error")
      setOcrError(t("ocr_failed"))
    }
  }

  const handleVideoFile = (file) => {
    setVideoFile(file)
    setVideoTranscript("")
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl)
    setVideoPreviewUrl(file ? URL.createObjectURL(file) : "")
  }

  const handleCheck = () => {
    if (tab === "text" && !text.trim()) {
      setError(t("error_text_required"))
      return
    }
    if (tab === "link" && !link.trim()) {
      setError(t("error_link_required"))
      return
    }
    if (tab === "image" && !imageFile) {
      setError(t("error_image_required"))
      return
    }
    if (tab === "image" && ocrStatus === "reading") {
      setError(t("error_ocr_wait"))
      return
    }
    if (tab === "image" && !ocrText.trim()) {
      setError(t("error_ocr_required"))
      return
    }
    if (tab === "video" && !videoFile) {
      setError(t("error_video_required"))
      return
    }
    if (tab === "video" && !videoTranscript.trim()) {
      setError(t("error_transcript_required"))
      return
    }
    setError("")
    onCheck?.({
      type: tab,
      content: {
        text: tab === "image" ? ocrText.trim() : text.trim(),
        link: link.trim(),
        transcript: videoTranscript.trim(),
        fileName: tab === "image" ? imageFile?.name : tab === "video" ? videoFile?.name : "",
      },
    })
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
            <div className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-background p-3">
              <label htmlFor="ocr-language" className="text-sm font-semibold text-muted-foreground">
                {t("ocr_language")}
              </label>
              <select
                id="ocr-language"
                value={ocrLanguage}
                onChange={(e) => setOcrLanguage(e.target.value)}
                className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold focus:outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
              >
                <option value="eng">{t("ocr_lang_english")}</option>
                <option value="hin">{t("ocr_lang_hindi")}</option>
                <option value="guj">{t("ocr_lang_gujarati")}</option>
                <option value="eng+hin+guj">{t("ocr_lang_mixed")}</option>
              </select>
            </div>
            <UploadBox accept="image/*" icon={ImageIcon} onFile={handleImageFile} />
            <p className="mt-3 flex items-center gap-2 text-base text-muted-foreground">
              <Info className="h-5 w-5 shrink-0 text-primary" />
              {t("help_image")}
            </p>
            {imageFile && (
              <div className="mt-5 rounded-2xl border border-border bg-background p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 font-semibold">
                    {ocrStatus === "reading" ? (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    ) : (
                      <FileText className="h-5 w-5 text-primary" />
                    )}
                    <span>{t("ocr_title")}</span>
                  </div>
                  {ocrStatus === "reading" && (
                    <span className="rounded-full bg-primary-soft px-3 py-1 text-sm font-bold text-primary">
                      {ocrProgress}%
                    </span>
                  )}
                  {ocrStatus === "done" && ocrConfidence !== null && (
                    <span className="rounded-full bg-primary-soft px-3 py-1 text-sm font-bold text-primary">
                      {t("ocr_confidence")}: {ocrConfidence}%
                    </span>
                  )}
                </div>
                {ocrStatus !== "reading" && (
                  <button
                    type="button"
                    onClick={() => runImageOcr()}
                    className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-bold text-primary hover:bg-muted"
                  >
                    <WandSparkles className="h-4 w-4" />
                    {t("ocr_read_again")}
                  </button>
                )}

                {ocrStatus === "reading" && (
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${Math.max(ocrProgress, 8)}%` }}
                    />
                  </div>
                )}

                <textarea
                  value={ocrText}
                  onChange={(e) => setOcrText(e.target.value)}
                  rows={4}
                  spellCheck={false}
                  placeholder={ocrStatus === "reading" ? t("ocr_reading") : t("ocr_placeholder")}
                  className="mt-4 w-full resize-none rounded-2xl border border-input bg-card px-4 py-3 text-base leading-relaxed focus:outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
                />

                {ocrError && (
                  <p className="mt-3 rounded-2xl bg-[var(--color-false-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-false)]">
                    {ocrError}
                  </p>
                )}
                {ocrStatus === "done" && (
                  <p className="mt-3 rounded-2xl bg-[var(--color-true-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-true)]">
                    {t("ocr_done")}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {tab === "video" && (
          <div>
            <p className="mb-2 text-lg font-semibold">{t("label_video")}</p>
            <UploadBox accept="video/*" icon={Video} onFile={handleVideoFile} />
            <p className="mt-3 flex items-center gap-2 text-base text-muted-foreground">
              <Info className="h-5 w-5 shrink-0 text-primary" />
              {t("help_video")}
            </p>
            {videoPreviewUrl && (
              <video
                src={videoPreviewUrl}
                controls
                className="mt-5 aspect-video w-full rounded-2xl border border-border bg-black object-contain"
              />
            )}
            {videoFile && (
              <div className="mt-5 rounded-2xl border border-border bg-background p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 font-semibold">
                    <FileText className="h-5 w-5 text-primary" />
                    <span>{t("transcript_title")}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setVideoTranscript(demoTranscript)}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-bold text-primary hover:bg-muted"
                  >
                    <WandSparkles className="h-4 w-4" />
                    {t("fill_demo_transcript")}
                  </button>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {t("transcript_help")}
                </p>
                <textarea
                  value={videoTranscript}
                  onChange={(e) => setVideoTranscript(e.target.value)}
                  rows={6}
                  placeholder={t("transcript_placeholder")}
                  className="mt-4 w-full resize-none rounded-2xl border border-input bg-card px-4 py-3 text-base leading-relaxed focus:outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
                />
              </div>
            )}
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
