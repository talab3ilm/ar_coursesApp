import { useState } from 'react'
import { applyHeadingTimes, formatTime, parseTime, summaryHeadings, updateSummary } from '../lib/admin'

/**
 * Temps des titres du résumé (marqueurs [m:ss]). Chaque ligne : titre, champ de temps, lien
 * pour vérifier dans la vidéo. Le résultat est enregistré dans summary_md ; « تنزيل » donne
 * le fichier à remettre dans le vault (resume-ok.md) pour que le pipeline garde ces temps.
 */
export default function TimestampEditor({ courseId, summary, videoId, onSaved }) {
  // Le parent remonte le composant avec key={summary} : l'état initial suit toujours le résumé courant.
  const headings = summaryHeadings(summary)
  const [values, setValues] = useState(() => Object.fromEntries(headings.map((h) => [h.line, formatTime(h.seconds)])))
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)

  if (!summary || headings.length === 0) return null

  const compute = () => {
    const times = {}
    for (const h of headings) {
      const s = parseTime(values[h.line] ?? '')
      if (Number.isNaN(s)) throw new Error(`وقت غير صالح عند « ${h.title} » (الصيغة: د:ثث أو س:دد:ثث)`)
      times[h.line] = s
    }
    return applyHeadingTimes(summary, times)
  }

  const save = async () => {
    setBusy(true)
    try {
      await updateSummary(courseId, compute())
      setStatus({ ok: true, text: 'تم حفظ الأوقات.' })
      onSaved?.()
    } catch (e) {
      setStatus({ ok: false, text: e.message })
    }
    setBusy(false)
  }

  const download = () => {
    try {
      const blob = new Blob([compute()], { type: 'text/markdown' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'resume-ok.md'
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    } catch (e) {
      setStatus({ ok: false, text: e.message })
    }
  }

  return (
    <section className="ts-editor">
      <h2>أوقات العناوين</h2>
      <p className="small muted">
        وقت بداية كل عنوان في الفيديو (د:ثث). اتركه فارغا لحذفه. الرابط ▶ يفتح الفيديو عند هذا الوقت للتحقق.
      </p>
      <table className="admin-table">
        <tbody>
          {headings.map((h) => {
            const s = parseTime(values[h.line] ?? '')
            return (
              <tr key={h.line}>
                <td style={{ paddingInlineStart: `${(h.level - 1) * 16}px` }}>{h.title}</td>
                <td className="ts-cell">
                  <input
                    dir="ltr"
                    value={values[h.line] ?? ''}
                    placeholder="m:ss"
                    aria-label={`وقت ${h.title}`}
                    className={Number.isNaN(s) ? 'invalid' : ''}
                    onChange={(e) => setValues({ ...values, [h.line]: e.target.value })}
                  />
                </td>
                <td>
                  {videoId && s !== null && !Number.isNaN(s) && (
                    <a href={`https://youtu.be/${videoId}?t=${s}`} target="_blank" rel="noreferrer" title="فتح الفيديو عند هذا الوقت">
                      ▶
                    </a>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="row">
        <button className="btn" onClick={save} disabled={busy}>
          حفظ الأوقات
        </button>
        <button className="btn btn-ghost" onClick={download}>
          تنزيل resume-ok.md بالأوقات
        </button>
      </div>
      <p className="small muted">
        تنبيه: إن كان الدرس في الإدارة الآلية، فالنشر التالي من المستودع يعيد حساب الأوقات. لتثبيتها: ضع الملف المنزَّل
        مكان resume-ok.md في المستودع (الأوقات المكتوبة يدويا تبقى كما هي)، أو ثبّت الدرس يدويا.
      </p>
      {status && (
        <p className={status.ok ? 'ok' : 'ko'} role="status">
          {status.text}
        </p>
      )}
    </section>
  )
}
