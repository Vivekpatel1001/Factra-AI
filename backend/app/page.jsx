const endpoints = [
  "GET /api/health",
  "POST /api/auth/signup",
  "POST /api/auth/login",
  "POST /api/auth/logout",
  "GET /api/me",
  "GET /api/reports",
  "POST /api/verify",
]

export default function BackendHome() {
  return (
    <main style={{ fontFamily: "Inter, system-ui, sans-serif", padding: 32, lineHeight: 1.5 }}>
      <h1>Factra AI Backend</h1>
      <p>Running with Next.js and Express.js.</p>
      <ul>
        {endpoints.map((endpoint) => (
          <li key={endpoint}>
            <code>{endpoint}</code>
          </li>
        ))}
      </ul>
    </main>
  )
}
