import { useEffect, useState } from 'react'
import { listAllCourses, listMindmapIds, listSubjects } from '../lib/admin'
import { ErrorBox, Loading } from '../components/Loading.jsx'
import CourseForm from './CourseForm.jsx'
import TypographySettings from './TypographySettings.jsx'
import Suggestions from './Suggestions.jsx'
import Reviewers from './Reviewers.jsx'

/** Liste de tous les cours (publiés ou non) et accès au formulaire. */
export default function Dashboard({ email, onSignOut }) {
  const [subjects, setSubjects] = useState(null)
  const [courses, setCourses] = useState(null)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null) // id du cours, 'new', ou null
  const [openBuilder, setOpenBuilder] = useState(false) // ouvrir le formulaire directement sur le constructeur de carte
  const [withMap, setWithMap] = useState(new Set())
  const [filter, setFilter] = useState('')

  const reload = () =>
    Promise.all([listSubjects(), listAllCourses(), listMindmapIds()])
      .then(([s, c, m]) => {
        setSubjects(s)
        setCourses(c)
        setWithMap(m)
      })
      .catch(setError)

  useEffect(() => {
    reload()
  }, [])

  if (error) return <ErrorBox error={error} />
  if (!courses) return <Loading />

  if (editing) {
    return (
      <CourseForm
        id={editing === 'new' ? null : editing}
        subjects={subjects}
        openBuilder={openBuilder}
        onDone={() => {
          setEditing(null)
          setOpenBuilder(false)
          reload()
        }}
      />
    )
  }

  const shown = courses.filter((c) => !filter || c.subject_id === filter)
  const nameOf = (id) => subjects.find((s) => s.id === id)?.name_ar ?? id

  return (
    <section className="admin">
      <header className="admin-head">
        <h1>لوحة الإدارة</h1>
        <span className="small muted">
          {email} ·{' '}
          <button className="link" onClick={onSignOut}>
            خروج
          </button>
        </span>
      </header>
      <Suggestions admin email={email} />
      <Reviewers />
      <TypographySettings />
      <div className="toolbar">
        <button className="btn" onClick={() => setEditing('new')}>
          + درس جديد
        </button>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="تصفية حسب المادة">
          <option value="">كل المواد</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name_ar}
            </option>
          ))}
        </select>
        <span className="small muted">{shown.length} درس</span>
      </div>
      {shown.length === 0 ? (
        <p className="muted">لا دروس بعد.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>المادة</th>
              <th>رقم</th>
              <th>العنوان</th>
              <th>التاريخ</th>
              <th>الحالة</th>
              <th>الإدارة</th>
              <th>الخريطة</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <tr key={c.id} className={c.published ? '' : 'muted'}>
                <td>{nameOf(c.subject_id)}</td>
                <td>{c.number ?? '—'}</td>
                <td>
                  {c.title}
                  <div className="small muted mono">{c.id}</div>
                </td>
                <td>{c.date ?? '—'}</td>
                <td>{c.published ? <span className="ok">منشور</span> : <span className="ko">غير منشور</span>}</td>
                <td>{c.managed_by === 'manual' ? 'يدوي' : 'آلي'}</td>
                <td>
                  <button
                    className={`tbtn ${withMap.has(c.id) ? '' : 'suggest'}`}
                    onClick={() => {
                      setOpenBuilder(true)
                      setEditing(c.id)
                    }}
                  >
                    {withMap.has(c.id) ? 'تحرير الخريطة' : '+ إنشاء الخريطة'}
                  </button>
                </td>
                <td>
                  <button className="tbtn" onClick={() => setEditing(c.id)}>
                    تعديل
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="small muted">
        « آلي » : الدرس يُحدَّث من المستودع عند كل نشر. « يدوي » : يبقى كما حُفظ هنا ولا يمسّه النشر الآلي.
      </p>
    </section>
  )
}
