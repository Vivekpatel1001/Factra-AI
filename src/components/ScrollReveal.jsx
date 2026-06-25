import { useEffect, useRef, useState } from "react"
import { cn } from "../lib/utils.js"

export default function ScrollReveal({
  as: Comp = "div",
  children,
  className,
  delay = 0,
  direction = "up",
  once = true,
  ...props
}) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          if (once) observer.unobserve(entry.target)
        } else if (!once) {
          setVisible(false)
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.18 },
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [once])

  return (
    <Comp
      ref={ref}
      className={cn("scroll-reveal", `scroll-reveal-${direction}`, visible && "is-visible", className)}
      style={{ "--reveal-delay": `${delay}ms` }}
      {...props}
    >
      {children}
    </Comp>
  )
}
