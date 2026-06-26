import { Routes, Route, useLocation } from "react-router-dom"
import { useEffect } from "react"
import { AppProvider } from "./context/AppContext.jsx"
import Navbar from "./components/Navbar.jsx"
import Footer from "./components/Footer.jsx"
import LandingPage from "./pages/LandingPage.jsx"
import VerifyPage from "./pages/VerifyPage.jsx"
import HowItWorksPage from "./pages/HowItWorksPage.jsx"
import AboutPage from "./pages/AboutPage.jsx"
import AuthPage from "./pages/AuthPage.jsx"
import SavedChecksPage from "./pages/SavedChecksPage.jsx"

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  return (
    <AppProvider>
      <ScrollToTop />
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/verify" element={<VerifyPage />} />
            <Route path="/how-it-works" element={<HowItWorksPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/signup" element={<AuthPage mode="signup" />} />
            <Route path="/saved" element={<SavedChecksPage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </AppProvider>
  )
}
