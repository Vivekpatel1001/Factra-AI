import { cn } from "../../lib/utils.js"

const variants = {
  primary:
    "bg-primary text-primary-foreground hover:brightness-110 shadow-lg shadow-primary/25",
  secondary:
    "bg-card text-foreground border border-border hover:bg-muted",
  soft: "bg-primary-soft text-primary hover:brightness-95",
  ghost: "bg-transparent text-foreground hover:bg-muted",
}

const sizes = {
  md: "px-5 py-3 text-base",
  lg: "px-7 py-4 text-lg",
  xl: "px-8 py-5 text-xl",
}

export default function Button({
  as: Comp = "button",
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}) {
  return (
    <Comp
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-ring/40 disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </Comp>
  )
}
