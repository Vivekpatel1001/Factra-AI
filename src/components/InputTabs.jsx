import { useEffect, useState } from "react"
import {
  MessageSquareText,
  Link2,
  Image as ImageIcon,
  Video,
  ShieldCheck,
  Info,
  Loader2,
  FileText,
  WandSparkles,
  ScanText,
} from "lucide-react"
import Button from "./ui/Button.jsx"
import Card from "./ui/Card.jsx"
import UploadBox from "./UploadBox.jsx"
import VoiceButton from "./VoiceButton.jsx"
import { extractVideoContent, extractVideoLinkContent } from "../lib/api.js"
import { useApp } from "../context/AppContext.jsx"

const canvasToBlob = (canvas) =>
  new Promise((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) resolve(value)
      else reject(new Error("Could not prepare image for OCR."))
    }, "image/png")
  })

async function preprocessImage(file) {
  const bitmap = await createImageBitmap(file)
  const maxSide = Math.max(bitmap.width, bitmap.height)
  const scale = Math.min(4, Math.max(2.4, 3400 / maxSide))
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
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
    const normalized = Math.max(0, Math.min(255, (gray - 128) * 2.05 + 128))
    const thresholded = normalized > 178 ? 255 : normalized < 118 ? 0 : normalized
    data[i] = thresholded
    data[i + 1] = thresholded
    data[i + 2] = thresholded
  }
  ctx.putImageData(imageData, 0, 0)

  const blob = await canvasToBlob(canvas)
  return {
    blob,
    canvas,
    width: canvas.width,
    height: canvas.height,
    previewUrl: URL.createObjectURL(blob),
  }
}

function cropCanvas(source, region) {
  const canvas = document.createElement("canvas")
  canvas.width = region.width
  canvas.height = region.height
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  ctx.drawImage(source, region.x, region.y, region.width, region.height, 0, 0, region.width, region.height)
  return canvas
}

function detectColumnSplit(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  const { width, height } = canvas
  const data = ctx.getImageData(0, 0, width, height).data
  const inkByX = new Array(width).fill(0)

  for (let y = Math.floor(height * 0.12); y < Math.floor(height * 0.94); y += 3) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4
      if (data[i] < 140) inkByX[x] += 1
    }
  }

  const smooth = inkByX.map((_, x) => {
    let total = 0
    let count = 0
    for (let dx = -12; dx <= 12; dx += 1) {
      const nx = x + dx
      if (nx >= 0 && nx < width) {
        total += inkByX[nx]
        count += 1
      }
    }
    return total / count
  })

  const start = Math.floor(width * 0.34)
  const end = Math.floor(width * 0.66)
  let bestX = Math.floor(width / 2)
  let bestScore = Number.POSITIVE_INFINITY
  for (let x = start; x <= end; x += 1) {
    if (smooth[x] < bestScore) {
      bestScore = smooth[x]
      bestX = x
    }
  }

  return bestX
}

function getOcrRegions(preparedImage, layout) {
  const full = { x: 0, y: 0, width: preparedImage.width, height: preparedImage.height, label: "Full page" }
  if (layout !== "newspaper" || preparedImage.width < 700) return [full]

  const splitX = detectColumnSplit(preparedImage.canvas)
  const overlap = Math.round(preparedImage.width * 0.018)
  const leftWidth = Math.min(preparedImage.width, splitX + overlap)
  const rightX = Math.max(0, splitX - overlap)

  return [
    { x: 0, y: 0, width: leftWidth, height: preparedImage.height, label: "Left column" },
    { x: rightX, y: 0, width: preparedImage.width - rightX, height: preparedImage.height, label: "Right column" },
  ]
}

function cleanOcrText(value) {
  const rawLines = String(value || "")
    .replace(/[|]{2,}/g, " ")
    .replace(/[ \t]+/g, " ")
    .split(/\n+/)
    .map((line) =>
      line
        .replace(/^[|:;'Ã¢â‚¬â„¢`.,\-\s]+/g, "")
        .replace(/[|]+/g, " ")
        .replace(/\s+([,.;:!?])/g, "$1")
        .trim(),
    )
    .filter(Boolean)

  const cleaned = rawLines.filter((line, index) => {
    const nextLine = rawLines[index + 1] || ""
    const isLikelyLogoArtifact =
      index === 0 && nextLine.length > 12 && /^[A-Z]{1,4}\.?$/.test(line) && !/[0-9]/.test(line)
    const isMostlyNoise = line.length <= 3 && !/[a-z0-9]/i.test(line)
    return !isLikelyLogoArtifact && !isMostlyNoise
  })

  const joined = []
  for (const line of cleaned) {
    const previous = joined[joined.length - 1]
    if (previous && /[a-z]-$/i.test(previous) && /^[a-z]/i.test(line)) {
      joined[joined.length - 1] = previous.slice(0, -1) + line
    } else {
      joined.push(line)
    }
  }

  return joined.join("\n").trim()
}

function mapOcrWords(words = [], offset = { x: 0, y: 0 }) {
  return words
    .map((word) => ({
      text: String(word.text || "").trim(),
      confidence: Math.round(word.confidence || 0),
      bbox: word.bbox
        ? {
            x0: word.bbox.x0 + offset.x,
            y0: word.bbox.y0 + offset.y,
            x1: word.bbox.x1 + offset.x,
            y1: word.bbox.y1 + offset.y,
          }
        : null,
    }))
    .filter((word) => word.text && word.bbox && word.confidence >= 28)
    .slice(0, 260)
}

function weightedConfidence(results) {
  let total = 0
  let weight = 0
  for (const result of results) {
    const textLength = Math.max(1, result.text.length)
    total += (result.confidence || 0) * textLength
    weight += textLength
  }
  return Math.round(total / Math.max(1, weight))
}


function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "")
    reader.onerror = () => reject(new Error("Could not read video file."))
    reader.readAsDataURL(file)
  })
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
  const [videoUrl, setVideoUrl] = useState("")
  const [ocrText, setOcrText] = useState("")
  const [ocrStatus, setOcrStatus] = useState("idle")
  const [ocrProgress, setOcrProgress] = useState(0)
  const [ocrConfidence, setOcrConfidence] = useState(null)
  const [ocrLanguage, setOcrLanguage] = useState("eng")
  const [ocrLayout, setOcrLayout] = useState("newspaper")
  const [ocrError, setOcrError] = useState("")
  const [ocrWords, setOcrWords] = useState([])
  const [ocrPreview, setOcrPreview] = useState(null)
  const [ocrRegions, setOcrRegions] = useState([])
  const [videoTranscript, setVideoTranscript] = useState("")
  const [videoExtractionStatus, setVideoExtractionStatus] = useState("idle")
  const [videoExtractionError, setVideoExtractionError] = useState("")
  const [videoLinkStatus, setVideoLinkStatus] = useState("idle")
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
      if (ocrPreview?.previewUrl) URL.revokeObjectURL(ocrPreview.previewUrl)
    }
  }, [videoPreviewUrl, ocrPreview])

  const resetOcrState = () => {
    setOcrText("")
    setOcrError("")
    setOcrProgress(0)
    setOcrConfidence(null)
    setOcrWords([])
    setOcrRegions([])
    setOcrPreview((previous) => {
      if (previous?.previewUrl) URL.revokeObjectURL(previous.previewUrl)
      return null
    })
  }

  const handleImageFile = async (file) => {
    setImageFile(file)
    resetOcrState()

    if (!file) {
      setOcrStatus("idle")
      return
    }

    await runImageOcr(file)
  }

  const recognizeRegion = async (Tesseract, preparedImage, region, index, count) => {
    const regionCanvas = cropCanvas(preparedImage.canvas, region)
    const regionBlob = await canvasToBlob(regionCanvas)
    const result = await Tesseract.recognize(regionBlob, ocrLanguage, {
      tessedit_pageseg_mode: region.label === "Full page" ? Tesseract.PSM.AUTO : Tesseract.PSM.SINGLE_BLOCK,
      tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
      preserve_interword_spaces: "1",
      user_defined_dpi: "300",
      tessedit_char_blacklist: "|~^_{}[]",
      logger: (message) => {
        if (message.status === "recognizing text") {
          const progress = ((index + (message.progress || 0)) / count) * 100
          setOcrProgress(Math.round(progress))
        }
      },
    })

    return {
      text: cleanOcrText(result.data.text),
      confidence: Math.round(result.data.confidence || 0),
      words: mapOcrWords(result.data.words, { x: region.x, y: region.y }),
    }
  }

  const runImageOcr = async (file = imageFile) => {
    if (!file) return
    resetOcrState()
    setOcrStatus("reading")
    try {
      const Tesseract = (await import("tesseract.js")).default
      const preparedImage = await preprocessImage(file)
      const regions = getOcrRegions(preparedImage, ocrLayout)
      setOcrPreview(preparedImage)
      setOcrRegions(regions)

      const results = []
      for (let i = 0; i < regions.length; i += 1) {
        results.push(await recognizeRegion(Tesseract, preparedImage, regions[i], i, regions.length))
      }

      const extracted = cleanOcrText(results.map((result) => result.text).filter(Boolean).join("\n\n"))
      setOcrText(extracted)
      setOcrWords(results.flatMap((result) => result.words))
      setOcrConfidence(weightedConfidence(results))
      setOcrStatus(extracted ? "done" : "empty")
      if (!extracted) setOcrError(t("ocr_empty"))
    } catch (err) {
      setOcrStatus("error")
      setOcrError(err.message || t("ocr_failed"))
    }
  }

  const handleVideoFile = async (file) => {
    setVideoFile(file)
    setVideoTranscript("")
    setVideoExtractionError("")
    setVideoExtractionStatus(file ? "reading" : "idle")
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl)
    setVideoPreviewUrl(file ? URL.createObjectURL(file) : "")

    if (!file) return

    try {
      if (file.size > 24 * 1024 * 1024) {
        throw new Error("This video is too large for direct upload extraction. Paste the YouTube, Facebook, Instagram, or source link below so Factra can search the public context and process the main claim.")
      }
      const data = await fileToBase64(file)
      const extraction = await extractVideoContent({ fileName: file.name, mimeType: file.type || "video/mp4", data })
      const parts = []
      if (extraction.speechTranscript) parts.push(`Speech transcript:\n${extraction.speechTranscript}`)
      if (extraction.visibleText) parts.push(`Visible text / OCR:\n${extraction.visibleText}`)
      if (!parts.length && extraction.combinedText) parts.push(extraction.combinedText)
      const extractedText = parts.join("\n\n").trim()
      setVideoTranscript(extractedText)
      setVideoExtractionStatus(extractedText ? "done" : "empty")
      if (!extractedText) setVideoExtractionError("No speech or visible text was detected. You can type the transcript manually.")
    } catch (err) {
      setVideoExtractionStatus("error")
      setVideoExtractionError(err.message || "Automatic video extraction failed. Please type the transcript manually.")
    }
  }


  const handleVideoUrlExtraction = async () => {
    const url = videoUrl.trim()
    if (!url) {
      setVideoExtractionError("Paste a public video link first.")
      return ""
    }

    setVideoExtractionError("")
    setVideoLinkStatus("reading")
    try {
      const extraction = await extractVideoLinkContent({ url })
      const parts = []
      if (extraction.combinedText) parts.push(extraction.combinedText)
      if (extraction.speechTranscript) parts.push(`Speech/context transcript:\n${extraction.speechTranscript}`)
      if (extraction.visibleText) parts.push(`Visible text / OCR:\n${extraction.visibleText}`)
      if (extraction.notes) parts.push(`Notes:\n${extraction.notes}`)
      const extractedText = parts.join("\n\n").trim()
      setVideoTranscript(extractedText)
      setVideoLinkStatus(extractedText ? "done" : "empty")
      if (!extractedText) setVideoExtractionError("Could not find public context for this video. Paste the spoken words or upload a shorter clip.")
      return extractedText
    } catch (err) {
      setVideoLinkStatus("error")
      setVideoExtractionError(err.message || "Could not process this video link. Paste the spoken words or upload a shorter clip.")
      return ""
    }
  }
  const handleCheck = async () => {
    if (tab === "text" && !text.trim()) return setError(t("error_text_required"))
    if (tab === "link" && !link.trim()) return setError(t("error_link_required"))
    if (tab === "image" && !imageFile) return setError(t("error_image_required"))
    if (tab === "image" && ocrStatus === "reading") return setError(t("error_ocr_wait"))
    if (tab === "image" && !ocrText.trim()) return setError(t("error_ocr_required"))
    if (tab === "video" && !videoFile && !videoUrl.trim()) return setError("Please upload a video or paste a public video link first.")
    if (tab === "video" && (videoExtractionStatus === "reading" || videoLinkStatus === "reading")) return setError("Please wait while we extract video text/context.")
    if (tab === "video" && videoUrl.trim() && !videoTranscript.trim()) {
      const extracted = await handleVideoUrlExtraction()
      if (!extracted.trim()) return setError(t("error_transcript_required"))
    }
    if (tab === "video" && !videoTranscript.trim()) return setError(t("error_transcript_required"))

    setError("")
    onCheck?.({
      type: tab,
      content: {
        text: tab === "image" ? ocrText.trim() : text.trim(),
        link: link.trim(),
        transcript: videoTranscript.trim(),
        videoUrl: videoUrl.trim(),
        fileName: tab === "image" ? imageFile?.name : tab === "video" ? videoFile?.name || videoUrl.trim() : "",
        ocr:
          tab === "image"
            ? { confidence: ocrConfidence, language: ocrLanguage, layout: ocrLayout, words: ocrWords }
            : undefined,
      },
    })
  }

  return (
    <Card className="p-4 sm:p-6">
      <div role="tablist" aria-label={t("choose_what_check")} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
              <label htmlFor="ocr-layout" className="text-sm font-semibold text-muted-foreground">
                OCR layout
              </label>
              <select
                id="ocr-layout"
                value={ocrLayout}
                onChange={(e) => setOcrLayout(e.target.value)}
                className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold focus:outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
              >
                <option value="newspaper">Newspaper columns</option>
                <option value="auto">Auto page</option>
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
                    <span className="rounded-full bg-primary-soft px-3 py-1 text-sm font-bold text-primary">{ocrProgress}%</span>
                  )}
                  {ocrStatus === "done" && ocrConfidence !== null && (
                    <span className="rounded-full bg-primary-soft px-3 py-1 text-sm font-bold text-primary">
                      {t("ocr_confidence")}: {ocrConfidence}%
                    </span>
                  )}
                </div>

                {ocrPreview?.previewUrl && (
                  <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
                    <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-bold text-muted-foreground">
                      <ScanText className="h-4 w-4 text-primary" /> OCR detection boxes
                    </div>
                    <div className="max-h-[520px] overflow-auto bg-black/5 p-3">
                      <div className="relative mx-auto max-w-full" style={{ aspectRatio: `${ocrPreview.width} / ${ocrPreview.height}` }}>
                        <img src={ocrPreview.previewUrl} alt="OCR processed preview" className="absolute inset-0 h-full w-full object-contain" />
                        {ocrRegions.map((region) => (
                          <span
                            key={region.label}
                            title={region.label}
                            className="absolute border-2 border-primary/70 bg-primary/5"
                            style={{
                              left: `${(region.x / ocrPreview.width) * 100}%`,
                              top: `${(region.y / ocrPreview.height) * 100}%`,
                              width: `${(region.width / ocrPreview.width) * 100}%`,
                              height: `${(region.height / ocrPreview.height) * 100}%`,
                            }}
                          />
                        ))}
                        {ocrWords.map((word, index) => {
                          const left = (word.bbox.x0 / ocrPreview.width) * 100
                          const top = (word.bbox.y0 / ocrPreview.height) * 100
                          const width = ((word.bbox.x1 - word.bbox.x0) / ocrPreview.width) * 100
                          const height = ((word.bbox.y1 - word.bbox.y0) / ocrPreview.height) * 100
                          return (
                            <span
                              key={`${word.text}-${index}`}
                              title={`${word.text} (${word.confidence}%)`}
                              className="absolute border border-[var(--color-true)] bg-[var(--color-true)]/15"
                              style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
                            />
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}

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
                    <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${Math.max(ocrProgress, 8)}%` }} />
                  </div>
                )}

                <textarea
                  value={ocrText}
                  onChange={(e) => setOcrText(e.target.value)}
                  rows={8}
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
                    Text extracted with visible OCR boxes. Review and edit it before checking.
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
            {videoPreviewUrl && <video src={videoPreviewUrl} controls className="mt-5 aspect-video w-full rounded-2xl border border-border bg-black object-contain" />}
            {(videoFile || videoUrl.trim()) && (
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
                  {videoExtractionStatus === "reading"
                    ? "Automatically extracting speech and visible text from the uploaded video..."
                    : videoExtractionStatus === "done"
                      ? "Automatic extraction finished. Review and edit the text before checking."
                      : t("transcript_help")}
                </p>
                {videoExtractionStatus === "reading" && (
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="loader-sweep h-full w-1/3 rounded-full bg-primary" />
                  </div>
                )}
                {videoExtractionError && (
                  <p className="mt-3 rounded-2xl bg-[var(--color-misleading-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-misleading)]">
                    {videoExtractionError}
                  </p>
                )}
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
        <p role="alert" className="mt-4 rounded-2xl bg-[var(--color-false-soft)] px-4 py-3 text-base font-medium text-[var(--color-false)]">
          {error}
        </p>
      )}

      <Button size="xl" className="mt-6 w-full" onClick={handleCheck}>
        <ShieldCheck className="h-6 w-6" /> {t("check_truth")}
      </Button>
    </Card>
  )
}
