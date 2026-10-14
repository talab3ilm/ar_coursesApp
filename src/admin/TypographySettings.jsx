import { useEffect, useState } from 'react'
import { DEFAULT_TYPOGRAPHY, FONTS, applyTypography, loadTypography, saveTypography } from '../lib/settings'

const KIND = { naskh: 'نسخ', sans: 'بلا تذييل', display: 'عناوين' }

/** Choix des polices et de la taille de lecture ; l'aperçu s'applique à la page en direct. */
export default function TypographySettings() {
  const [typo, setTypo] = useState(null)
  const [status, setStatus] = useState(null)

  useEffect(() => {
    loadTypography().then(setTypo)
  }, [])

  if (!typo) return null

  const set = (k, v) => {
    const next = { ...typo, [k]: v }
    setTypo(next)
    applyTypography(next)
  }
  const fontSelect = (k, label) => (
    <label>
      {label}
      <select value={typo[k]} onChange={(e) => set(k, e.target.value)}>
        {FONTS.map((f) => (
          <option key={f.name} value={f.name}>
            {f.name} ({KIND[f.kind]})
          </option>
        ))}
      </select>
    </label>
  )
  const num = (k, label, step, min, max) => (
    <label>
      {label}
      <input type="number" dir="ltr" step={step} min={min} max={max} value={typo[k]} onChange={(e) => set(k, Number(e.target.value))} />
    </label>
  )

  return (
    <details className="settings">
      <summary>الإعدادات · الخطوط</summary>
      <div className="form-grid">
        {fontSelect('read', 'خط القراءة (الملخّص، البطاقات، الخريطة)')}
        {fontSelect('display', 'خط العناوين والآيات والشعر')}
        {fontSelect('body', 'خط الواجهة (القوائم والأزرار)')}
        {num('readSize', 'حجم خط القراءة (rem)', 0.05, 0.9, 2)}
        {num('readLineHeight', 'ارتفاع السطر', 0.05, 1.4, 3)}
        {num('wordSpacing', 'تباعد الكلمات (em)', 0.02, 0, 0.5)}
      </div>
      <p className="sample">
        <span style={{ fontFamily: 'var(--f-read)', fontSize: 'var(--read-size)', lineHeight: 'var(--read-lh)', wordSpacing: 'var(--read-ws)' }}>
          نموذج: السيرة النبوية هي كل ما يتعلق بحياة النبي ﷺ من مولده إلى وفاته، شاملا حياته الخاصة وأسفاره ومغازيه وشمائله.
        </span>
      </p>
      <div className="row">
        <button
          className="btn"
          onClick={async () => {
            try {
              await saveTypography(typo)
              setStatus({ ok: true, text: 'تم حفظ الخطوط، وستظهر للطلبة عند إعادة تحميل الصفحة.' })
            } catch (e) {
              setStatus({ ok: false, text: e.message })
            }
          }}
        >
          حفظ
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => {
            setTypo(DEFAULT_TYPOGRAPHY)
            applyTypography(DEFAULT_TYPOGRAPHY)
          }}
        >
          الافتراضي
        </button>
      </div>
      {status && (
        <p className={status.ok ? 'ok' : 'ko'} role="status">
          {status.text}
        </p>
      )}
    </details>
  )
}
