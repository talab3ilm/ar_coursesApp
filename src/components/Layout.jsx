import { Link, NavLink, Outlet } from 'react-router-dom'

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
          <NavLink to="/about">عن الموقع</NavLink>
        </nav>
      </header>
      <main className="shell">
        <Outlet />
      </main>
      <footer className="footer">
        <span>التقدّم محفوظ في هذا المتصفح فقط.</span>
        <Link to="/about">عن الموقع</Link>
      </footer>
    </div>
  )
}
