import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { fetchCatalog } from '../lib/api'
import { getSnapshot } from '../lib/progress'
import { ErrorBox, Loading } from '../components/Loading.jsx'

export default function Home() {
  const [catalog, setCatalog] = useState(null)
  const [error, setError] = useState(null)
  const [params, setParams] = useSearchParams()

  useEffect(() => {
    fetchCatalog().then(setCatalog).catch(setError)
  }, [])

  if (error) return <ErrorBox error={error} />
  if (!catalog) return <Loading />

  const current = catalog.find((s) => s.id === params.get('s')) ?? catalog.find((s) => s.courses.length) ?? catalog[0]
  const lastCourse = getSnapshot().lastCourse

  return (
    <>
      <header className="hero">
        <h1>مراجعة الدروس</h1>
        <p className="lead">ملخّص، بطاقات مراجعة، وخريطة ذهنية لكل درس، من إعداد الطلبة لأنفسهم.</p>
        {lastCourse && (
          <Link className="btn btn-ghost" to={`/c/${lastCourse}`}>
            متابعة آخر درس ←
          </Link>
        )}
      </header>

      <div className="tabs" role="tablist" aria-label="المواد">
        {catalog.map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={s.id === current?.id}
            className={`tab ${s.id === current?.id ? 'active' : ''}`}
            onClick={() => setParams({ s: s.id })}
          >
            {s.name_ar}
            {s.courses.length ? <span className="count">{s.courses.length}</span> : <span className="soon">قريبا</span>}
          </button>
        ))}
      </div>

      {current && (
        <section className="panel" role="tabpanel">
          <h2>{current.name_ar}</h2>
          {current.courses.length === 0 ? (
            <p className="muted">لم تُنشر دروس هذه المادة بعد — قريبا إن شاء الله.</p>
          ) : (
            <ol className="course-list">
              {current.courses.map((c) => (
                <li key={c.id}>
                  <Link to={`/c/${c.id}`} className="course-item">
                    <span className="num">{c.number ?? '•'}</span>
                    <span className="course-title">{c.title}</span>
                    <span className="meta">
                      {c.teacher && <span>{c.teacher}</span>}
                      {c.date && <span>{c.date}</span>}
                      {c.duration && <span>{c.duration}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </>
  )
}
