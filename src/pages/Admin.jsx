import { useEffect, useState } from 'react'
import { getSession, isAdmin, isReviewer, onAuth, signIn, signOut } from '../lib/admin'
import { Loading } from '../components/Loading.jsx'
import Dashboard from '../admin/Dashboard.jsx'
import Suggestions from '../admin/Suggestions.jsx'

/** /admin : connexion Supabase Auth (e-mail + mot de passe), puis vérification de la liste blanche. */
export default function Admin() {
  const [session, setSession] = useState(undefined)
  const [adminFor, setAdminFor] = useState(null) // { userId, value } : résultat de la liste blanche
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getSession().then(setSession)
    const sub = onAuth(setSession)
    return () => sub.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    const userId = session.user.id
    isAdmin()
      .then(async (value) => setAdminFor({ userId, value: value ? 'admin' : (await isReviewer().catch(() => false)) ? 'reviewer' : false }))
      .catch((e) => setError(e.message))
  }, [session])
  const admin = session && adminFor?.userId === session.user.id ? adminFor.value : null

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await signIn(form.email.trim(), form.password)
    if (error) setError('تعذّر تسجيل الدخول: تحقّق من البريد وكلمة المرور.')
    setBusy(false)
  }

  if (session === undefined) return <Loading />

  if (!session) {
    return (
      <form className="login" onSubmit={submit}>
        <h1>لوحة الإدارة</h1>
        <label>
          البريد الإلكتروني
          <input type="email" dir="ltr" autoComplete="username" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label>
          كلمة المرور
          <input type="password" dir="ltr" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </label>
        {error && <p className="ko">{error}</p>}
        <button className="btn" disabled={busy}>
          دخول
        </button>
      </form>
    )
  }

  if (admin === null) return <Loading />
  if (admin === 'reviewer') {
    return (
      <section className="admin">
        <header className="admin-head">
          <h1>مراجعة الاقتراحات</h1>
          <span className="small muted">
            {session.user.email} ·{' '}
            <button className="link" onClick={signOut}>
              خروج
            </button>
          </span>
        </header>
        <Suggestions admin={false} email={session.user.email} />
      </section>
    )
  }
  if (admin === false) {
    return (
      <div className="notice notice-error">
        <p>هذا الحساب ({session.user.email}) ليس في قائمة المشرفين ولا المراجعين.</p>
        <button className="btn btn-ghost" onClick={signOut}>
          خروج
        </button>
      </div>
    )
  }

  return <Dashboard email={session.user.email} onSignOut={signOut} />
}
