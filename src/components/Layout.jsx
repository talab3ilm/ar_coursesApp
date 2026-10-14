import { Link, NavLink, Outlet } from 'react-router-dom'
import ErrorBoundary from './ErrorBoundary.jsx'

export default function Layout() {
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          دروس الأكاديمية
        </Link>
        <nav className="topnav">
          <NavLink to="/" end>
            الرئيسية
          </NavLink>
          <NavLink to="/progress">التقدّم</NavLink>
          <NavLink to="/about">عن الموقع</NavLink>
        </nav>
      </header>
      <main className="shell">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
      <footer className="footer">
        <span>
          التقدّم محفوظ في هذا المتصفح فقط. <Link to="/progress">صدّره</Link>
        </span>
        <Link to="/about">عن الموقع</Link>
      </footer>
    </div>
  )
}
