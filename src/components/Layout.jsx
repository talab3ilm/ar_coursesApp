import { useEffect } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import ErrorBoundary from './ErrorBoundary.jsx'
import ThemeToggle from './ThemeToggle.jsx'
import { loadTypography } from '../lib/settings'

export default function Layout() {
  useEffect(() => {
    loadTypography().catch(() => {}) // sans réglage en base, les valeurs par défaut du CSS restent
  }, [])
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          مراجعة الدروس
        </Link>
        <nav className="topnav">
          <NavLink to="/" end>
            الرئيسية
          </NavLink>
          <NavLink to="/progress">التقدّم</NavLink>
          <NavLink to="/contribute">ساهم</NavLink>
          <NavLink to="/about">عن الموقع</NavLink>
          <ThemeToggle />
        </nav>
      </header>
      <main className="shell">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
      <footer className="footer">
        <span>التقدّم محفوظ في هذا المتصفح فقط.</span>
        <span>عمل طلابي مستقل، لا يمثّل الأكاديمية.</span>
      </footer>
    </div>
  )
}
