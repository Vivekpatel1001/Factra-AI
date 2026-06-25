import { CheckCircle2, XCircle, AlertTriangle, HelpCircle, ShieldAlert } from "lucide-react"

// Maps each verdict to friendly colors, translation keys and icon.
export const verdictConfig = {
  TRUE: {
    labelKey: "verdict_true",
    icon: CheckCircle2,
    color: "var(--color-true)",
    soft: "var(--color-true-soft)",
    chip: "bg-[var(--color-true-soft)] text-[var(--color-true)]",
    textKey: "verdict_true_text",
  },
  FALSE: {
    labelKey: "verdict_false",
    icon: XCircle,
    color: "var(--color-false)",
    soft: "var(--color-false-soft)",
    chip: "bg-[var(--color-false-soft)] text-[var(--color-false)]",
    textKey: "verdict_false_text",
  },
  MISLEADING: {
    labelKey: "verdict_misleading",
    icon: AlertTriangle,
    color: "var(--color-misleading)",
    soft: "var(--color-misleading-soft)",
    chip: "bg-[var(--color-misleading-soft)] text-[var(--color-misleading)]",
    textKey: "verdict_misleading_text",
  },
  RISKY: {
    labelKey: "verdict_risky",
    icon: ShieldAlert,
    color: "var(--color-false)",
    soft: "var(--color-false-soft)",
    chip: "bg-[var(--color-false-soft)] text-[var(--color-false)]",
    textKey: "verdict_risky_text",
  },
  UNVERIFIED: {
    labelKey: "verdict_unverified",
    icon: HelpCircle,
    color: "var(--color-unverified)",
    soft: "var(--color-unverified-soft)",
    chip: "bg-[var(--color-unverified-soft)] text-[var(--color-unverified)]",
    textKey: "verdict_unverified_text",
  },
}

export function getVerdict(key, t = (value) => value) {
  const config = verdictConfig[key] || verdictConfig.UNVERIFIED
  return {
    ...config,
    label: t(config.labelKey),
    text: t(config.textKey),
  }
}
