import { useEffect, useState } from 'react'
import { addReviewer, listReviewers, removeReviewer } from '../lib/admin'

/** Liste blanche des relecteurs (admins seulement). Le compte Auth se crée dans le tableau de bord Supabase. */
export default function Reviewers() {
  const [rows, setRows] = useState(null)
  const [email, setEmail] = useState('')
  const [error, setError] = useState(null)
  const reload = () => listReviewers().then(setRows).catch((e) => setError(e.message))
  useEffect(() => {
    reload()
  }, [])
  const add = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      await addReviewer(email)
      setEmail('')
      reload()
    } catch (err) {
      setError(err.message)
    }
  }
  return (
    <details className="settings">
      <summary>المراجعون ({rows?.length ?? '…'})</summary>
      <p className="small muted">
        المراجع يرى الاقتراحات ويُعدّ النص المصحَّح، ولا يستطيع النشر ولا تعديل الدروس. أنشئ له حسابا (بريد وكلمة مرور)
        في Supabase ثم أضف بريده هنا.
      </p>
      {rows && (
        <ul className="items">
          {rows.map((r) => (
            <li key={r.email} className="row" style={{ marginTop: 0 }}>
              <span className="mono">{r.email}</span>
              <button className="link" onClick={() => removeReviewer(r.email).then(reload)}>
                إزالة
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="row" onSubmit={add}>
        <input type="email" dir="ltr" required placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className="btn btn-ghost">إضافة مراجع</button>
      </form>
      {error && <p className="ko">{error}</p>}
    </details>
  )
}
