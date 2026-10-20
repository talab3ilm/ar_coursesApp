import { useEffect, useState } from 'react'
import { getSession, isAdmin, isReviewer, onAuth, sendMagicLink, signOut, verifyCode } from '../lib/admin'
import { Loading } from '../components/Loading.jsx'
import Dashboard from '../admin/Dashboard.jsx'
import Suggestions from '../admin/Suggestions.jsx'

/**
 * /admin : connexion Supabase Auth par lien magique (e-mail seul, sans mot de passe, pour ne pas ressembler à une
 * page de hameçonnage), puis vérification de la liste blanche.
 */
export default function Admin() {
  const [session, setSession] = useState(undefined)
  const [adminFor, setAdminFor] = useState(null) // { userId, value } : résultat de la liste blanche
  const [form, setForm] = useState({ email: '', code: '' })
  const [sent, setSent] = useState(false) // courriel envoyé : on attend le clic sur le lien ou le code
  const [showCode, setShowCode] = useState(false) // le code n'est dans le courriel qu'avec un modèle personnalisé (SMTP propre)
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
    const email = form.email.trim().toLowerCase()
    if (!sent) {
      const { error } = await sendMagicLink(email)
      // Même message si l'adresse est inconnue : on ne révèle pas la liste des comptes.
      if (error && !/signup|not allowed|not found/i.test(error.message)) setError(`تعذّر الإرسال: ${error.message}`)
      else setSent(true)
    } else {
      const { error } = await verifyCode(email, form.code.trim())
      if (error) setError('الرمز غير صحيح أو انتهت صلاحيته.')
    }
    setBusy(false)
  }

  if (session === undefined) return <Loading />

  if (!session) {
    return (
      <form className="login" onSubmit={submit}>
        <h1>لوحة الإدارة</h1>
        <p className="small muted">للمشرفين والمراجعين فقط. يُرسل رابط الدخول إلى بريدك، بلا كلمة مرور.</p>
        <label>
          البريد الإلكتروني
          <input
            type="email"
            dir="ltr"
            autoComplete="email"
            required
            disabled={sent}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </label>
        {sent && (
          <>
            <p className="ok" role="status">
              إن كان البريد مسجّلا فقد وصلته رسالة: افتح رابط الدخول فيها (من هذا الجهاز أو غيره).
            </p>
            {showCode ? (
              <label>
                الرمز المذكور في الرسالة
                <input
                  dir="ltr"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6,8}"
                  autoFocus
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </label>
            ) : (
              <button type="button" className="link small" onClick={() => setShowCode(true)}>
                وصلك رمز رقمي بدل الرابط؟
              </button>
            )}
          </>
        )}
        {error && <p className="ko">{error}</p>}
        {(!sent || showCode) && (
          <button className="btn" disabled={busy || (sent && !form.code.trim())}>
            {sent ? 'دخول بالرمز' : 'إرسال رابط الدخول'}
          </button>
        )}
        {sent && (
          <button
            type="button"
            className="link"
            onClick={() => {
              setSent(false)
              setShowCode(false)
              setForm({ ...form, code: '' })
              setError(null)
            }}
          >
            إعادة الإرسال أو تغيير البريد
          </button>
        )}
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
