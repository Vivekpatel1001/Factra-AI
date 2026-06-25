import { useRef, useState } from "react"
import { UploadCloud, FileCheck2, X } from "lucide-react"
import { useApp } from "../context/AppContext.jsx"

export default function UploadBox({ accept, icon: Icon, onFile }) {
  const { t } = useApp()
  const inputRef = useRef(null)
  const [fileName, setFileName] = useState("")
  const [dragOver, setDragOver] = useState(false)

  const handleFile = (file) => {
    if (file) {
      setFileName(file.name)
      onFile?.(file)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          handleFile(e.dataTransfer.files?.[0])
        }}
        className={`flex w-full flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
          dragOver ? "border-primary bg-primary-soft" : "border-input bg-background hover:border-primary/50"
        }`}
      >
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          {Icon ? <Icon className="h-8 w-8" /> : <UploadCloud className="h-8 w-8" />}
        </span>
        <span className="text-lg font-semibold text-foreground">{t("drop_here")}</span>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </button>

      {fileName && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
          <span className="flex items-center gap-2 truncate text-base font-medium">
            <FileCheck2 className="h-5 w-5 shrink-0 text-[var(--color-true)]" />
            <span className="truncate">{fileName}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              setFileName("")
              if (inputRef.current) inputRef.current.value = ""
              onFile?.(null)
            }}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
            aria-label={t("remove_file")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
