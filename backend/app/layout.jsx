export const metadata = {
  title: "Factra AI Backend",
  description: "Next.js backend surface for the Factra AI Express API",
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
