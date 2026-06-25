import { cn } from "../../lib/utils.js"

export default function Card({ className, glass = false, children, ...props }) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-border shadow-xl shadow-black/30",
        glass ? "glass" : "bg-card",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
