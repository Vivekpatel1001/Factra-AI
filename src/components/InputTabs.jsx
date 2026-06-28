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
import { extractImageContent, extractVideoContent, extractVideoLinkContent } from "../lib/api.js"
import { useApp } from "../context/AppContext.jsx"

const TESSDATA_CDN = "https://tessdata.projectnaptha.com/4.0.0"

function resolveOcrLanguages(ocrLanguage, uiLanguage) {
  if (ocrLanguage === "eng+hin+guj") return "eng+hin+guj"
  if (ocrLanguage === "auto") {
    if (uiLanguage === "hi") return "hin+eng"
    if (uiLanguage === "gu") return "guj+eng"
    return "eng+hin"
  }
  if (ocrLanguage === "hin") return "hin+eng"
  if (ocrLanguage === "guj") return "guj+eng"
  return ocrLanguage
}

const canvasToBlob = (canvas) =>
  new Promise((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) resolve(value)
      else reject(new Error("Could not prepare image for OCR."))
    }, "image/png")
  })

function getOtsuThreshold(histogram, totalPixels) {
  let sum = 0
  for (let i = 0; i < 256; i += 1) sum += i * histogram[i]

  let sumBackground = 0
  let weightBackground = 0
  let bestVariance = 0
  let threshold = 160

  for (let i = 0; i < 256; i += 1) {
    weightBackground += histogram[i]
    if (!weightBackground) continue
    const weightForeground = totalPixels - weightBackground
    if (!weightForeground) break

    sumBackground += i * histogram[i]
    const meanBackground = sumBackground / weightBackground
    const meanForeground = (sum - sumBackground) / weightForeground
    const variance = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2
    if (variance > bestVariance) {
      bestVariance = variance
      threshold = i
    }
  }

  return threshold
}

function prepareImageData(imageData, mode) {
  const { data, width, height } = imageData
  const gray = new Uint8ClampedArray(width * height)
  const histogram = new Array(256).fill(0)

  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    const value = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114)
    gray[p] = value
    histogram[value] += 1
  }

  const threshold = getOtsuThreshold(histogram, gray.length)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const p = y * width + x
      const i = p * 4
      const original = gray[p]
      const left = gray[y * width + Math.max(0, x - 1)]
      const right = gray[y * width + Math.min(width - 1, x + 1)]
      const top = gray[Math.max(0, y - 1) * width + x]
      const bottom = gray[Math.min(height - 1, y + 1) * width + x]
      const sharpened = Math.max(0, Math.min(255, original * 1.72 - (left + right + top + bottom) * 0.18))
      const contrasted = Math.max(0, Math.min(255, (sharpened - 128) * 1.45 + 128))
      const value = mode === "binary" ? (contrasted > threshold - 6 ? 255 : 0) : contrasted
      data[i] = value
      data[i + 1] = value
      data[i + 2] = value
      data[i + 3] = 255
    }
  }

  return imageData
}

function renderPreparedCanvas(bitmap, mode) {
  const maxSide = Math.max(bitmap.width, bitmap.height)
  const scale = Math.min(4.4, Math.max(2.2, 3600 / maxSide))
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)

  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.fillStyle = "#fff"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  ctx.putImageData(prepareImageData(ctx.getImageData(0, 0, canvas.width, canvas.height), mode), 0, 0)
  return canvas
}

async function preprocessImage(file) {
  const bitmap = await createImageBitmap(file)
  const canvas = renderPreparedCanvas(bitmap, "enhanced")
  const binaryCanvas = renderPreparedCanvas(bitmap, "binary")
  const blob = await canvasToBlob(canvas)
  return {
    blob,
    canvas,
    binaryCanvas,
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

function cleanOcrLine(value) {
  return String(value || "")
    .replace(/[|]{2,}/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/^[|:;'`.,\-\s]+/g, "")
    .replace(/[|]+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim()
}

function cleanOcrText(value) {
  const rawLines = String(value || "")
    .split(/\n+/)
    .map(cleanOcrLine)
    .filter(Boolean)

  const cleaned = rawLines.filter((line, index) => {
    const nextLine = rawLines[index + 1] || ""
    const isLikelyLogoArtifact =
      index === 0 && nextLine.length > 12 && /^[A-Z]{1,4}\.?$/.test(line) && !/[0-9]/.test(line)
    const isMostlyNoise = line.length <= 3 && !/[a-z0-9\u0900-\u097F\u0A80-\u0AFF]/i.test(line)
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

function formatOcrLines(lines = [], fallbackText = "") {
  const lineText = lines
    .map((line) => cleanOcrLine(line.text))
    .filter(Boolean)

  return lineText.length ? lineText.join("\n").trim() : cleanOcrText(fallbackText)
}

function formatOcrResults(results = [], layout = "auto") {
  const sections = results.map((result) => result.text).filter(Boolean)
  if (!sections.length) return ""
  return layout === "newspaper" ? sections.join("\n\n") : cleanOcrText(sections.join("\n"))
}

function mapOcrBox(item, offset = { x: 0, y: 0 }) {
  const text = cleanOcrLine(item?.text)
  const bbox = item?.bbox
  if (!text || !bbox) return null
  return {
    text,
    confidence: Math.round(item.confidence || 0),
    bbox: {
      x0: bbox.x0 + offset.x,
      y0: bbox.y0 + offset.y,
      x1: bbox.x1 + offset.x,
      y1: bbox.y1 + offset.y,
    },
  }
}

function mapOcrWords(words = [], offset = { x: 0, y: 0 }) {
  return words
    .map((word) => mapOcrBox(word, offset))
    .filter((word) => word && word.confidence >= 45)
    .slice(0, 320)
}

function mapOcrLines(lines = [], offset = { x: 0, y: 0 }) {
  return lines
    .map((line) => mapOcrBox(line, offset))
    .filter((line) => line && line.text.length > 1 && line.confidence >= 35)
    .slice(0, 120)
}

function detectOcrLanguage(text = "") {
  const counts = {
    eng: (text.match(/[A-Za-z]/g) || []).length,
    hin: (text.match(/[\u0900-\u097F]/g) || []).length,
    guj: (text.match(/[\u0A80-\u0AFF]/g) || []).length,
  }
  const active = Object.entries(counts).filter(([, count]) => count >= 4)
  if (active.length > 1) return "mixed"
  if (!active.length) return "unknown"
  return active.sort((a, b) => b[1] - a[1])[0][0]
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


function scoreOcrResult(result) {
  const text = cleanOcrText(result?.text || "")
  const confidence = Math.max(0, result?.confidence || 0)
  const lineCount = (text.match(/\n/g) || []).length + (text ? 1 : 0)
  const usefulChars = (text.match(/[a-z0-9\u0900-\u097F\u0A80-\u0AFF]/gi) || []).length
  return confidence + Math.min(26, usefulChars / 18) + Math.min(12, lineCount * 1.5)
}

function selectBestOcrResult(results = []) {
  return results
    .filter((result) => cleanOcrText(result?.text || ""))
    .sort((a, b) => scoreOcrResult(b) - scoreOcrResult(a))[0] || results[0] || { text: "", confidence: 0, words: [], lines: [] }
}
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "")
    reader.onerror = () => reject(new Error("Could not read video file."))
    reader.readAsDataURL(file)
  })
}
function extractKeywords(value, limit = 12) {
  const stopWords = new Set([
    "the", "and", "for", "with", "this", "that", "from", "have", "has", "are", "was", "were", "will", "you", "your", "not", "but", "all", "any", "can", "our", "their", "they", "his", "her", "she", "him", "its", "into", "about", "after", "before", "speech", "transcript", "visible", "text", "ocr",
  ])
  const counts = new Map()
  for (const token of String(value || "").toLowerCase().match(/[a-z0-9\u0900-\u097f\u0a80-\u0aff]{3,}/g) || []) {
    if (stopWords.has(token)) continue
    counts.set(token, (counts.get(token) || 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, limit)
    .map(([token]) => token)
}
const demoTranscript = [
  "[00:12] Government is giving free money to everyone.",
  "[00:28] Register today using this link to claim your reward.",
  "[00:40] Share this with everyone before it is removed.",
].join("\n")

export default function InputTabs({ initialTab = "text", onCheck }) {
  const { t, language } = useApp()
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
  const defaultOcrLanguage = language === "hi" ? "hin" : language === "gu" ? "guj" : "eng"
  const [ocrLanguage, setOcrLanguage] = useState(defaultOcrLanguage)
  const [ocrLanguageManual, setOcrLanguageManual] = useState(false)
  const [ocrLayout, setOcrLayout] = useState("auto")
  const [ocrError, setOcrError] = useState("")
  const [ocrWords, setOcrWords] = useState([])
  const [ocrLines, setOcrLines] = useState([])
  const [ocrDetectedLanguage, setOcrDetectedLanguage] = useState("")
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

  const ocrLanguageLabels = {
    eng: t("ocr_lang_english"),
    hin: t("ocr_lang_hindi"),
    guj: t("ocr_lang_gujarati"),
    mixed: t("ocr_lang_mixed"),
    unknown: t("ocr_lang_unknown"),
  }

  useEffect(() => {
    if (!ocrLanguageManual) setOcrLanguage(defaultOcrLanguage)
  }, [defaultOcrLanguage, ocrLanguageManual])

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
    setOcrLines([])
    setOcrDetectedLanguage("")
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

  const recognizeWithTesseract = async (file, preparedImage, regions) => {
    const { createWorker, PSM, OEM } = await import("tesseract.js")
    const recognitionLanguage = resolveOcrLanguages(ocrLanguage, language)
    const worker = await createWorker(recognitionLanguage, OEM.LSTM_ONLY, {
      langPath: TESSDATA_CDN,
      logger: (message) => {
        if (message.status === "loading tesseract core") setOcrProgress(8)
        if (message.status === "initializing tesseract") setOcrProgress(12)
        if (message.status === "loading language traineddata") {
          setOcrProgress(Math.round(12 + (message.progress || 0) * 28))
        }
        if (message.status === "recognizing text") {
          setOcrProgress(Math.round(40 + (message.progress || 0) * 55))
        }
      },
    })

    try {
      const results = []
      for (let index = 0; index < regions.length; index += 1) {
        const region = regions[index]
        const pageMode = region.label === "Full page" ? PSM.AUTO : PSM.SINGLE_BLOCK
        const canvases = [
          { canvas: cropCanvas(preparedImage.canvas, region), variant: "enhanced" },
          { canvas: cropCanvas(preparedImage.binaryCanvas, region), variant: "binary" },
        ]
        const candidates = []

        for (const item of canvases) {
          const regionBlob = await canvasToBlob(item.canvas)
          await worker.setParameters({
            tessedit_pageseg_mode: pageMode,
            preserve_interword_spaces: "1",
            user_defined_dpi: "300",
          })
          const result = await worker.recognize(regionBlob)
          candidates.push({
            text: formatOcrLines(result.data.lines, result.data.text),
            confidence: Math.round(result.data.confidence || 0),
            words: mapOcrWords(result.data.words, { x: region.x, y: region.y }),
            lines: mapOcrLines(result.data.lines, { x: region.x, y: region.y }),
            variant: `${item.variant}-${recognitionLanguage}`,
          })
        }

        results.push(selectBestOcrResult(candidates))
      }
      return results
    } finally {
      await worker.terminate()
    }
  }

  const runImageOcr = async (file = imageFile) => {
    if (!file) return
    resetOcrState()
    setOcrStatus("reading")
    setOcrProgress(5)

    try {
      const preparedImage = await preprocessImage(file)
      const regions = getOcrRegions(preparedImage, ocrLayout)
      setOcrPreview(preparedImage)
      setOcrRegions(regions)

      let extracted = ""
      let confidence = 0
      let backendError = ""

      try {
        setOcrProgress(10)
        const data = await fileToBase64(file)
        const backend = await extractImageContent({
          fileName: file.name,
          mimeType: file.type || "image/png",
          data,
          language,
        })
        extracted = cleanOcrText(backend.text || "")
        confidence = backend.confidence || (extracted ? 90 : 0)
        if (extracted) {
          setOcrText(extracted)
          setOcrConfidence(confidence)
          setOcrDetectedLanguage(detectOcrLanguage(extracted))
          setOcrProgress(100)
          setOcrStatus("done")
          return
        }
      } catch (error) {
        backendError = error.message || t("ocr_failed")
      }

      setOcrProgress(18)
      const results = await recognizeWithTesseract(file, preparedImage, regions)
      extracted = formatOcrResults(results, ocrLayout)
      confidence = weightedConfidence(results)

      if (!extracted.trim() && backendError) {
        throw new Error(backendError)
      }

      if ((!extracted.trim() || confidence < 40) && !backendError) {
        try {
          const data = await fileToBase64(file)
          const backend = await extractImageContent({
            fileName: file.name,
            mimeType: file.type || "image/png",
            data,
            language,
          })
          const backendText = cleanOcrText(backend.text || "")
          if (backendText && scoreOcrResult({ text: backendText, confidence: backend.confidence || 0 }) >= scoreOcrResult({ text: extracted, confidence })) {
            extracted = backendText
            confidence = backend.confidence || 90
          }
        } catch {
          // Keep Tesseract output if backend retry fails.
        }
      }

      setOcrText(extracted)
      setOcrWords(results.flatMap((result) => result.words))
      setOcrLines(results.flatMap((result) => result.lines))
      setOcrDetectedLanguage(detectOcrLanguage(extracted))
      setOcrConfidence(confidence)
      setOcrProgress(100)
      setOcrStatus(extracted ? "done" : "empty")
      if (!extracted) setOcrError(backendError || t("ocr_empty"))
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
        throw new Error(t("video_large_direct_upload"))
      }
      const data = await fileToBase64(file)
      const extraction = await extractVideoContent({ fileName: file.name, mimeType: file.type || "video/mp4", data })
      const parts = []
      if (extraction.speechTranscript) parts.push(`${t("video_speech_transcript_prefix")}\n${extraction.speechTranscript}`)
      if (extraction.visibleText) parts.push(`${t("video_visible_text_prefix")}\n${extraction.visibleText}`)
      if (!parts.length && extraction.combinedText) parts.push(extraction.combinedText)
      const extractedText = parts.join("\n\n").trim()
      setVideoTranscript(extractedText)
      setVideoExtractionStatus(extractedText ? "done" : "empty")
      if (!extractedText) setVideoExtractionError(t("video_no_speech_text"))
    } catch (err) {
      setVideoExtractionStatus("error")
      setVideoExtractionError(err.message || t("video_extract_failed"))
    }
  }


  const handleVideoUrlExtraction = async () => {
    const url = videoUrl.trim()
    if (!url) {
      setVideoExtractionError(t("video_paste_link_first"))
      return ""
    }

    setVideoExtractionError("")
    setVideoLinkStatus("reading")
    try {
      const extraction = await extractVideoLinkContent({ url })
      const parts = []
      if (extraction.combinedText) parts.push(extraction.combinedText)
      if (extraction.speechTranscript) parts.push(`${t("video_context_transcript_prefix")}\n${extraction.speechTranscript}`)
      if (extraction.visibleText) parts.push(`${t("video_visible_text_prefix")}\n${extraction.visibleText}`)
      const extractedText = parts.join("\n\n").trim()
      setVideoTranscript(extractedText)
      setVideoLinkStatus(extractedText ? "done" : "empty")
      if (!extractedText) setVideoExtractionError(extraction.notes || t("video_no_public_context"))
      return extractedText
    } catch (err) {
      setVideoLinkStatus("error")
      setVideoExtractionError(err.message || t("video_link_failed"))
      return ""
    }
  }
  const handleCheck = async () => {
    if (tab === "text" && !text.trim()) return setError(t("error_text_required"))
    if (tab === "link" && !link.trim()) return setError(t("error_link_required"))
    if (tab === "image" && !imageFile) return setError(t("error_image_required"))
    if (tab === "image" && ocrStatus === "reading") return setError(t("error_ocr_wait"))
    if (tab === "image" && !ocrText.trim()) return setError(t("error_ocr_required"))
    if (tab === "video" && !videoFile && !videoUrl.trim()) return setError(t("video_need_upload_or_link"))
    if (tab === "video" && (videoExtractionStatus === "reading" || videoLinkStatus === "reading")) return setError(t("video_wait_extracting"))
    if (tab === "video" && videoUrl.trim() && !videoTranscript.trim()) {
      const extracted = await handleVideoUrlExtraction()
      if (!extracted.trim()) return setError(t("error_transcript_required"))
    }
    if (tab === "video" && !videoTranscript.trim()) return setError(t("error_transcript_required"))

    setError("")
    const finalText = tab === "image" ? ocrText.trim() : tab === "video" ? videoTranscript.trim() : text.trim()

    const content = { text: finalText }
    if (tab === "link") content.link = link.trim()
    if (tab === "video") {
      content.transcript = videoTranscript.trim()
      content.videoUrl = videoUrl.trim()
      content.keywords = extractKeywords(videoTranscript)
      content.fileName = videoFile?.name || videoUrl.trim()
    }
    if (tab === "image") {
      content.fileName = imageFile?.name || ""
      content.ocr = { confidence: ocrConfidence, language: ocrLanguage, layout: ocrLayout, words: ocrWords }
      content.ocrConfidence = ocrConfidence
    }

    onCheck?.({
      type: tab,
      language,
      content,
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
                onChange={(e) => {
                  const nextLanguage = e.target.value
                  setOcrLanguage(nextLanguage)
                  setOcrLanguageManual(nextLanguage !== defaultOcrLanguage)
                }}
                className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold focus:outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
              >
                <option value="auto">{t("ocr_auto_detect")}</option>
                <option value="eng">{t("ocr_lang_english")}</option>
                <option value="hin">{t("ocr_lang_hindi")}</option>
                <option value="guj">{t("ocr_lang_gujarati")}</option>
                <option value="eng+hin+guj">{t("ocr_lang_mixed")}</option>
              </select>
              <label htmlFor="ocr-layout" className="text-sm font-semibold text-muted-foreground">
                {t("ocr_layout")}
              </label>
              <select
                id="ocr-layout"
                value={ocrLayout}
                onChange={(e) => setOcrLayout(e.target.value)}
                className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold focus:outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
              >
                <option value="auto">{t("ocr_layout_auto")}</option>
                <option value="newspaper">{t("ocr_layout_newspaper")}</option>
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
                  {ocrStatus === "done" && ocrDetectedLanguage && (
                    <span className="rounded-full bg-card px-3 py-1 text-sm font-bold text-muted-foreground ring-1 ring-border">
                      {t("ocr_detected")}: {ocrLanguageLabels[ocrDetectedLanguage] || ocrDetectedLanguage}
                    </span>
                  )}
                </div>

                {ocrPreview?.previewUrl && (
                  <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
                    <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-bold text-muted-foreground">
                      <ScanText className="h-4 w-4 text-primary" /> {t("ocr_detection_boxes")}
                    </div>
                    <div className="max-h-[520px] overflow-auto bg-black/5 p-3">
                      <div className="relative mx-auto max-w-full" style={{ aspectRatio: `${ocrPreview.width} / ${ocrPreview.height}` }}>
                        <img src={ocrPreview.previewUrl} alt={t("ocr_processed_preview_alt")} className="absolute inset-0 h-full w-full object-contain" />
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
                        {ocrLines.map((line, index) => {
                          const left = (line.bbox.x0 / ocrPreview.width) * 100
                          const top = (line.bbox.y0 / ocrPreview.height) * 100
                          const width = ((line.bbox.x1 - line.bbox.x0) / ocrPreview.width) * 100
                          const height = ((line.bbox.y1 - line.bbox.y0) / ocrPreview.height) * 100
                          return (
                            <span
                              key={`line-${index}-${line.text}`}
                              title={line.text}
                              className="absolute rounded-sm border-2 border-primary bg-primary/10 shadow-[0_0_0_1px_rgba(255,255,255,0.65)]"
                              style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
                            />
                          )
                        })}
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
                  className="mt-4 w-full resize-y rounded-2xl border border-input bg-card px-4 py-3 font-mono text-base leading-7 focus:outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
                />

                {ocrError && (
                  <p className="mt-3 rounded-2xl bg-[var(--color-false-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-false)]">
                    {ocrError}
                  </p>
                )}
                {ocrStatus === "done" && (
                  <p className="mt-3 rounded-2xl bg-[var(--color-true-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-true)]">
                    {t("ocr_done_with_boxes")}
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
            <div className="mt-4">
              <label htmlFor="video-link" className="mb-2 block text-base font-semibold">
                {t("label_video_link")}
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  id="video-link"
                  type="url"
                  value={videoUrl}
                  onChange={(e) => {
                    setVideoUrl(e.target.value)
                    setVideoExtractionError("")
                  }}
                  placeholder={t("ph_video_link")}
                  className="w-full rounded-2xl border border-input bg-background px-4 py-4 text-lg focus:outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
                />
                <button
                  type="button"
                  onClick={handleVideoUrlExtraction}
                  disabled={videoLinkStatus === "reading" || !videoUrl.trim()}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-border bg-card px-5 py-3 text-base font-bold text-primary hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {videoLinkStatus === "reading" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Link2 className="h-5 w-5" />}
                  {t("video_extract_link")}
                </button>
              </div>
            </div>
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
                    ? t("video_extracting_status")
                    : videoExtractionStatus === "done"
                      ? t("video_extraction_done")
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







