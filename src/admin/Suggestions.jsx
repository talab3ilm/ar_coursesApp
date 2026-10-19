import { useEffect, useState } from 'react'
import { applySuggestion, deleteSuggestion, listSuggestions, updateSuggestion } from '../lib/admin'
import { KINDS, TABS } from '../lib/suggest'
import { ErrorBox, Loading } from '../components/Loading.jsx'

const STATUS = { new: 'جديد', reviewed: 'رُوجع', accepted: 'مقبول', rejected: 'مرفوض', applied: 'طُبّق' }
const KIND = Object.fromEntries(KINDS)
const OPEN = ['new', 'reviewed']

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/** Champs du texte corrigé : une zone pour le résumé et la carte, deux (question / réponse) pour une carte. */
function FixEditor({ s, fix, setFix }) {
  if (s.tab === 'review') {
    let v = { question: '', answer: '' }
    try {
      v = JSON.parse(fix)
    } catch {
      const [q = '', a = ''] = s.original.split('\n---\n')
      v = { question: q, answer: a }
    }
    const set = (k, val) => setFix(JSON.stringify({ ...v, [k]: val }))
    return (
      <>
        <label>
          السؤال المصحَّح
          <textarea rows={2} value={v.question} onChange={(e) => set('question', e.target.value)} />
        </label>
        <label>
          الجواب المصحَّح
          <textarea rows={4} value={v.answer} onChange={(e) => set('answer', e.target.value)} />
        </label>
      </>
    )
  }
  return (
    <label>
      {s.tab === 'summary' ? 'نص القسم المصحَّح (Markdown، يحلّ محلّ القسم كله)' : 'النص المصحَّح للفرع (يُطبَّق يدويا في mindmap-ok.json)'}
      <textarea rows={s.tab === 'summary' ? 10 : 5} value={fix} onChange={(e) => setFix(e.target.value)} />
    </label>
  )
}

function Item({ s, admin, email, onChange }) {
  const [open, setOpen] = useState(false)
  const [fix, setFix] = useState(s.fix ?? (s.tab === 'review' ? '' : s.original))
  const [note, setNote] = useState(s.note ?? '')
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const act = async (fn, okText) => {
    setBusy(true)
    setMsg(null)
    try {
      const r = await fn()
      setMsg({ ok: true, text: okText, file: r ?? null })
      onChange()
    } catch (e) {
      setMsg({ ok: false, text: e.message })
    } finally {
      setBusy(false)
    }
  }
  const date = new Date(s.created_at).toISOString().slice(0, 10)
  return (
    <li className={`sugg s-${s.status}`}>
      <button type="button" className="sugg-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className={`badge st-${s.status}`}>{STATUS[s.status]}</span>
        <strong>{s.courses?.title ?? s.course_id}</strong>
        <span className="muted">
          {TABS[s.tab]} · {KIND[s.kind]} · {date}
          {s.author ? ` · ${s.author}` : ''}
        </span>
      </button>
      {open && (
        <div className="sugg-body">
          {s.location && (
            <p className="small muted">
              الموضع: <span dir="auto">{s.location}</span>
            </p>
          )}
          <div className="sugg-cols">
            <div>
              <h4>النص الحالي</h4>
              <pre dir="auto">{s.original || '—'}</pre>
            </div>
            <div>
              <h4>اقتراح الطالب</h4>
              <pre dir="auto">{s.proposed}</pre>
            </div>
          </div>
          {s.status !== 'applied' && s.status !== 'rejected' && <FixEditor s={s} fix={fix} setFix={setFix} />}
          {s.status === 'applied' && s.fix && (
            <>
              <h4>ما طُبّق</h4>
              <pre dir="auto">{s.fix}</pre>
            </>
          )}
          <label>
            ملاحظة داخلية
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          {s.reviewed_by && (
            <p className="small muted">
              آخر مراجعة: {s.reviewed_by} · {s.reviewed_at?.slice(0, 10)}
            </p>
          )}
          <div className="row">
            {OPEN.includes(s.status) && (
              <button className="btn btn-ghost" disabled={busy} onClick={() => act(() => updateSuggestion(s.id, { status: 'reviewed', fix, note }, email), 'حُفظت المراجعة.')}>
                حفظ المراجعة
              </button>
            )}
            {admin && s.status !== 'applied' && (
              <button
                className="btn"
                disabled={busy}
                onClick={() =>
                  act(
                    () => applySuggestion(s, fix, email),
                    s.tab === 'map' ? 'سُجّل كمطبَّق. طبّقه يدويا في mindmap-ok.json داخل الـ vault.' : 'طُبّق في الموقع، والدرس الآن في وضع manual. نزّل الملف وضعه في الـ vault ثم أعد الدرس إلى pipeline.',
                  )
                }
              >
                {s.tab === 'map' ? 'تم التطبيق يدويا' : 'قبول وتطبيق'}
              </button>
            )}
            {admin && s.status !== 'rejected' && s.status !== 'applied' && (
              <button className="btn btn-ghost" disabled={busy} onClick={() => act(() => updateSuggestion(s.id, { status: 'rejected', note }, email), 'رُفض.')}>
                رفض
              </button>
            )}
            {admin && (
              <button
                className="link"
                disabled={busy}
                onClick={() => {
                  if (window.confirm('حذف هذا الاقتراح نهائيا؟')) act(() => deleteSuggestion(s.id), 'حُذف.')
                }}
              >
                حذف
              </button>
            )}
          </div>
          {msg && (
            <p className={msg.ok ? 'ok' : 'ko'} role="status">
              {msg.text}{' '}
              {msg.file && (
                <button className="link" onClick={() => download(msg.file.name, msg.file.text)}>
                  تنزيل {msg.file.name}
                </button>
              )}
            </p>
          )}
        </div>
      )}
    </li>
  )
}

/** Triage des suggestions : relecteurs (préparer le texte) et admins (appliquer, refuser). */
export default function Suggestions({ admin, email }) {
  const [scope, setScope] = useState('open') // open | done
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)
  const reload = () =>
    listSuggestions(scope === 'open' ? OPEN : ['accepted', 'rejected', 'applied'])
      .then(setRows)
      .catch(setError)
  useEffect(() => {
    reload()
  }, [scope]) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <ErrorBox error={error} />
  return (
    <section className="suggestions">
      <div className="toolbar">
        <h2 style={{ margin: 0 }}>اقتراحات الطلبة</h2>
        <div className="seg" role="group" aria-label="النطاق">
          <button aria-pressed={scope === 'open'} onClick={() => setScope('open')}>
            قيد المعالجة
          </button>
          <button aria-pressed={scope === 'done'} onClick={() => setScope('done')}>
            المنتهية
          </button>
        </div>
        {rows && <span className="small muted">{rows.length}</span>}
      </div>
      {!rows ? (
        <Loading />
      ) : rows.length === 0 ? (
        <p className="muted">لا اقتراحات.</p>
      ) : (
        <ul className="sugg-list">
          {rows.map((s) => (
            <Item key={s.id + s.status} s={s} admin={admin} email={email} onChange={reload} />
          ))}
        </ul>
      )}
    </section>
  )
}
