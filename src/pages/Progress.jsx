import { useRef, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { exportJson, getSnapshot, importCards, markExported, parseImport, subscribe, trackedCount } from '../lib/progress'

const fmtDate = (ts) => (ts ? new Date(ts).toLocaleString('ar-MA', { dateStyle: 'medium', timeStyle: 'short' }) : null)

export function ProgressWarning({ compact = false }) {
  return (
    <div className={`notice notice-warn ${compact ? 'small' : ''}`} role="note">
      <p>
        <strong>تنبيه:</strong> تقدّمك محفوظ في هذا المتصفح فقط. إن مسحت بيانات المتصفح أو غيّرت الجهاز ضاع كلّه.
        {compact ? (
          <>
            {' '}
            <Link to="/progress">صدّره من حين لآخر.</Link>
          </>
        ) : (
          ' صدّره إلى ملف من حين لآخر، واحتفظ بالملف.'
        )}
      </p>
    </div>
  )
}

export default function Progress() {
  const state = useSyncExternalStore(subscribe, getSnapshot)
  const [pending, setPending] = useState(null) // import lu, en attente de confirmation
  const [mode, setMode] = useState('merge')
  const [message, setMessage] = useState(null)
  const fileInput = useRef(null)
  const tracked = trackedCount()

  const download = () => {
    const blob = new Blob([exportJson()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ar-courses-progress-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    markExported()
    setMessage({ ok: true, text: 'تم تصدير التقدّم. احتفظ بالملف في مكان آمن.' })
  }

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setPending({ ...parseImport(await file.text()), name: file.name })
      setMessage(null)
    } catch (err) {
      setPending(null)
      setMessage({ ok: false, text: err.message })
    }
    e.target.value = ''
  }

  const confirmImport = () => {
    importCards(pending.cards, mode, pending.known)
    setMessage({ ok: true, text: `تم استيراد ${pending.count} بطاقة (${mode === 'merge' ? 'دمج' : 'استبدال'}).` })
    setPending(null)
  }

  return (
    <article className="prose progress-page">
      <h1>التقدّم</h1>
      <ProgressWarning />

      <ul className="stats">
        <li>
          بطاقات مُتابَعة: <strong>{tracked}</strong>
        </li>
        <li>
          آخر تصدير: <strong>{fmtDate(state.lastExport) ?? 'لم يتم بعد'}</strong>
        </li>
        <li>
          إجابات منذ آخر تصدير: <strong>{state.answersSinceExport ?? 0}</strong>
        </li>
      </ul>

      <h2>تصدير</h2>
      <p>يُنزَّل ملف JSON يحتوي تقدّمك في كل الدروس. يمكنك نقله إلى جهاز آخر أو الاحتفاظ به نسخة احتياطية.</p>
      <button className="btn" onClick={download} disabled={tracked === 0}>
        تصدير التقدّم
      </button>

      <h2>استيراد</h2>
      <p>اختر ملفا صدّرته من قبل. يمكنك دمجه مع التقدّم الحالي (تُحفظ أعلى درجة لكل بطاقة) أو استبدال كل شيء به.</p>
      <input ref={fileInput} type="file" accept="application/json,.json" onChange={onFile} hidden />
      <button className="btn btn-ghost" onClick={() => fileInput.current?.click()}>
        اختيار ملف…
      </button>

      {pending && (
        <div className="notice import-box">
          <p>
            <strong>{pending.name}</strong> · {pending.count} بطاقة
            {pending.exportedAt && <> · صُدّر في {fmtDate(Date.parse(pending.exportedAt))}</>}
          </p>
          <div className="seg" role="group" aria-label="طريقة الاستيراد">
            <button aria-pressed={mode === 'merge'} onClick={() => setMode('merge')}>
              دمج
            </button>
            <button aria-pressed={mode === 'replace'} onClick={() => setMode('replace')}>
              استبدال
            </button>
          </div>
          <div className="row">
            <button className="btn" onClick={confirmImport}>
              تأكيد الاستيراد
            </button>
            <button className="btn btn-ghost" onClick={() => setPending(null)}>
              إلغاء
            </button>
          </div>
        </div>
      )}

      {message && (
        <p className={message.ok ? 'ok' : 'ko'} role="status">
          {message.text}
        </p>
      )}
    </article>
  )
}
