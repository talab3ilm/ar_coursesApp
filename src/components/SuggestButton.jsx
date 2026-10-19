import { useState } from 'react'
import { KINDS, TABS, rememberedAuthor, sendSuggestion } from '../lib/suggest'

/**
 * Bouton « اقترح تصحيحا » et sa petite fenêtre. Le contexte (cours, onglet, emplacement, texte d'origine)
 * est rempli automatiquement ; l'élève choisit un type, écrit sa proposition, signe s'il veut.
 */
export default function SuggestButton({ courseId, tab, location, original, context, label = 'اقترح تصحيحا' }) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState('error')
  const [proposed, setProposed] = useState('')
  const [author, setAuthor] = useState(rememberedAuthor)
  const [website, setWebsite] = useState('') // piège à robots, caché
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState(null)

  const close = () => {
    setOpen(false)
    setStatus(null)
  }
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await sendSuggestion({ courseId, tab, location, kind, original, proposed, author, website })
      setStatus({ ok: true, text: 'وصل اقتراحك، جزاك الله خيرا. سيُراجَع قبل نشره.' })
      setProposed('')
    } catch (err) {
      setStatus({ ok: false, text: err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" className="tbtn suggest" onClick={() => setOpen(true)} title="اقتراح تصحيح أو إضافة لهذا الجزء">
        ✎ {label}
      </button>
      {open && (
        <>
          <div className="modal-backdrop" onClick={close} />
          <form className="modal" role="dialog" aria-modal="true" aria-label="اقتراح تصحيح" onSubmit={submit}>
            <button type="button" className="tbtn sheet-close" onClick={close} aria-label="إغلاق">
              ✕
            </button>
            <h3>اقتراح تصحيح</h3>
            <p className="small muted">
              {TABS[tab]}
              {(context ?? location) ? ` · ${context ?? location}` : ''}
            </p>
            <label>
              نوع الاقتراح
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                {KINDS.map(([k, name]) => (
                  <option key={k} value={k}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              اقتراحك
              <textarea
                rows={5}
                required
                maxLength={6000}
                value={proposed}
                onChange={(e) => setProposed(e.target.value)}
                placeholder="اكتب التصحيح أو الإضافة كما تودّ أن تظهر، مع ذكر الموضع إن لزم."
              />
            </label>
            <label>
              اسمك أو كنيتك (اختياري، يُذكر في الشكر)
              <input type="text" maxLength={80} value={author} onChange={(e) => setAuthor(e.target.value)} />
            </label>
            <label className="hp" aria-hidden="true">
              website
              <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </label>
            {status && (
              <p className={status.ok ? 'ok' : 'ko'} role="status">
                {status.text}
              </p>
            )}
            <div className="row">
              <button className="btn" disabled={busy || status?.ok}>
                إرسال
              </button>
              <button type="button" className="btn btn-ghost" onClick={close}>
                {status?.ok ? 'إغلاق' : 'إلغاء'}
              </button>
            </div>
            <p className="small muted">لا يُنشر شيء قبل مراجعته. لا يُطلب حساب ولا بريد.</p>
          </form>
        </>
      )}
    </>
  )
}
