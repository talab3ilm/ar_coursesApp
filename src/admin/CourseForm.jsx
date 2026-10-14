import { useEffect, useState } from 'react'
import {
  deleteCourse, loadCourse, parseCards, parseChapters, parseMindmap, replaceCards, replaceChapters,
  saveCourse, saveMindmap, setManaged, setPublished, stripFrontmatter, uploadFile,
} from '../lib/admin'
import { ErrorBox, Loading } from '../components/Loading.jsx'
import SummaryTab from '../components/SummaryTab.jsx'
import MindmapTab from '../components/MindmapTab.jsx'
import { youtubeId } from '../lib/arabic'

const EMPTY = { id: '', subject_id: '', number: '', title: '', teacher: '', date: '', duration: '', youtube_url: '' }

/** Formulaire d'un cours : métadonnées, dépôt des trois fichiers, aperçu, publication. */
export default function CourseForm({ id, subjects, onDone }) {
  const [course, setCourse] = useState(id ? undefined : null)
  const [fields, setFields] = useState({ ...EMPTY, subject_id: subjects[0]?.id ?? '' })
  const [files, setFiles] = useState({}) // { resume: {text, cards?}, anki: {text, cards}, mindmap: {text, tree} }
  const [preview, setPreview] = useState(null) // 'summary' | 'mindmap'
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!id) return
    loadCourse(id)
      .then((c) => {
        setCourse(c)
        if (c) setFields({ ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, c[k] ?? ''])) })
      })
      .catch(setError)
  }, [id])

  const set = (k) => (e) => setFields({ ...fields, [k]: e.target.value })
  const courseId = fields.id.trim()

  const onFile = (kind) => async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    try {
      const text = await f.text()
      if (kind === 'resume') setFiles({ ...files, resume: { name: f.name, text: stripFrontmatter(text) } })
      if (kind === 'anki') setFiles({ ...files, anki: { name: f.name, text, cards: await parseCards(text, courseId) } })
      if (kind === 'mindmap') setFiles({ ...files, mindmap: { name: f.name, text, tree: parseMindmap(text) } })
      setStatus(null)
    } catch (err) {
      setStatus({ ok: false, text: `ملف غير صالح (${f.name}) : ${err.message}` })
    }
    e.target.value = ''
  }

  const save = async () => {
    if (!courseId || !fields.subject_id || !fields.title.trim()) {
      return setStatus({ ok: false, text: 'المعرّف والمادة والعنوان مطلوبة.' })
    }
    setBusy(true)
    setStatus(null)
    try {
      const row = {
        id: courseId,
        subject_id: fields.subject_id,
        number: fields.number === '' ? null : Number(fields.number),
        title: fields.title.trim(),
        teacher: fields.teacher.trim() || null,
        date: fields.date || null,
        duration: fields.duration.trim() || null,
        youtube_url: fields.youtube_url.trim() || null,
      }
      if (files.resume) row.summary_md = files.resume.text
      if (!id) {
        row.published = false
        row.managed_by = 'manual' // un cours créé ici n'est pas écrasé par le pipeline
      }
      await saveCourse(row)
      const subject = row.subject_id
      if (files.resume) {
        await uploadFile(subject, courseId, 'resume.md', files.resume.text, 'text/markdown')
        await replaceChapters(courseId, parseChapters(files.resume.text, courseId))
      }
      if (files.anki) {
        await replaceCards(courseId, files.anki.cards)
        await uploadFile(subject, courseId, 'anki.tsv', files.anki.text, 'text/tab-separated-values')
      }
      if (files.mindmap) {
        await saveMindmap(courseId, files.mindmap.tree)
        await uploadFile(subject, courseId, 'mindmap.json', files.mindmap.text, 'application/json')
      }
      setStatus({ ok: true, text: 'تم الحفظ.' })
      setFiles({})
      setPreview(null) // l'aperçu de la carte dépend du fichier déposé
      setCourse(await loadCourse(courseId))
    } catch (err) {
      setStatus({ ok: false, text: `فشل الحفظ : ${err.message}` })
    }
    setBusy(false)
  }

  const toggle = async (fn, label) => {
    setBusy(true)
    try {
      await fn()
      setCourse(await loadCourse(courseId))
      setStatus({ ok: true, text: label })
    } catch (err) {
      setStatus({ ok: false, text: err.message })
    }
    setBusy(false)
  }

  const remove = async () => {
    if (!window.confirm(`حذف الدرس « ${fields.title} » وكل بطاقاته نهائيا؟`)) return
    setBusy(true)
    try {
      await deleteCourse(courseId, course?.subject_id ?? fields.subject_id)
      onDone()
    } catch (err) {
      setStatus({ ok: false, text: err.message })
      setBusy(false)
    }
  }

  if (error) return <ErrorBox error={error} />
  if (course === undefined) return <Loading />

  return (
    <section className="admin">
      <header className="admin-head">
        <h1>{id ? 'تعديل درس' : 'درس جديد'}</h1>
        <button className="link" onClick={onDone}>
          ← العودة إلى القائمة
        </button>
      </header>

      <div className="form-grid">
        <label>
          المعرّف (معرّف يوتيوب أو معرّف المنصة)
          <input dir="ltr" value={fields.id} onChange={set('id')} disabled={!!id} required />
        </label>
        <label>
          المادة
          <select value={fields.subject_id} onChange={set('subject_id')}>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name_ar}
              </option>
            ))}
          </select>
        </label>
        <label>
          رقم الدرس
          <input type="number" min="1" value={fields.number} onChange={set('number')} />
        </label>
        <label className="wide">
          العنوان
          <input value={fields.title} onChange={set('title')} required />
        </label>
        <label>
          المدرّس
          <input value={fields.teacher} onChange={set('teacher')} />
        </label>
        <label>
          التاريخ
          <input type="date" value={fields.date} onChange={set('date')} />
        </label>
        <label>
          المدة (hh:mm:ss)
          <input dir="ltr" value={fields.duration} onChange={set('duration')} />
        </label>
        <label className="wide">
          رابط يوتيوب
          <input dir="ltr" value={fields.youtube_url} onChange={set('youtube_url')} />
        </label>
      </div>

      <h2>الملفات</h2>
      {course && (
        <p className="small muted">
          في القاعدة الآن: {course.summary_md ? 'ملخّص' : 'لا ملخّص'} · {course.cardCount} بطاقة · {course.chapterCount} فصل ·{' '}
          {course.hasMindmap ? 'خريطة' : 'لا خريطة'}
        </p>
      )}
      <div className="file-grid">
        {[
          ['resume', 'resume.md (الملخّص)', '.md,text/markdown'],
          ['anki', 'anki.tsv (البطاقات)', '.tsv,text/tab-separated-values,text/plain'],
          ['mindmap', 'mindmap.json (الخريطة)', '.json,application/json'],
        ].map(([kind, label, accept]) => (
          <label key={kind} className="file-field">
            <span>{label}</span>
            <input type="file" accept={accept} onChange={onFile(kind)} disabled={!courseId} />
            {files[kind] && (
              <span className="small ok">
                {files[kind].name}
                {kind === 'anki' && ` · ${files[kind].cards.length} بطاقة`}
                {kind === 'resume' && ` · ${parseChapters(files[kind].text, courseId).length} فصل`}
              </span>
            )}
          </label>
        ))}
      </div>
      {!courseId && <p className="small muted">أدخل المعرّف أولا لتفعيل رفع الملفات.</p>}

      {(files.resume || course?.summary_md || files.mindmap) && (
        <div className="row">
          {(files.resume || course?.summary_md) && (
            <button className="tbtn" onClick={() => setPreview(preview === 'summary' ? null : 'summary')}>
              {preview === 'summary' ? 'إخفاء الملخّص' : 'معاينة الملخّص'}
            </button>
          )}
          {files.mindmap && (
            <button className="tbtn" onClick={() => setPreview(preview === 'mindmap' ? null : 'mindmap')}>
              {preview === 'mindmap' ? 'إخفاء الخريطة' : 'معاينة الخريطة'}
            </button>
          )}
        </div>
      )}
      {preview === 'summary' && (
        <div className="panel preview">
          <SummaryTab markdown={files.resume?.text ?? course?.summary_md} videoId={youtubeId(fields)} onSeek={() => {}} />
        </div>
      )}
      {preview === 'mindmap' && files.mindmap && (
        <div className="panel preview">
          <MindmapTab tree={files.mindmap.tree} />
        </div>
      )}

      <div className="row actions">
        <button className="btn" onClick={save} disabled={busy}>
          حفظ
        </button>
        {course && (
          <>
            <button className="btn btn-ghost" disabled={busy} onClick={() => toggle(() => setPublished(courseId, !course.published), course.published ? 'أُلغي النشر.' : 'نُشر الدرس.')}>
              {course.published ? 'إلغاء النشر' : 'نشر'}
            </button>
            <button
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => toggle(() => setManaged(courseId, course.managed_by === 'manual' ? 'pipeline' : 'manual'), 'تم تغيير نمط الإدارة.')}
            >
              {course.managed_by === 'manual' ? 'إعادة إلى الإدارة الآلية' : 'تثبيت يدويا (لا يمسّه النشر الآلي)'}
            </button>
            <button className="btn btn-danger" disabled={busy} onClick={remove}>
              حذف
            </button>
          </>
        )}
      </div>
      {status && (
        <p className={status.ok ? 'ok' : 'ko'} role="status">
          {status.text}
        </p>
      )}
    </section>
  )
}
