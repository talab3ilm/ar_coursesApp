import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { appliedSuggestions, fetchCourse } from '../lib/api'
import { youtubeId } from '../lib/arabic'
import { rememberCourse } from '../lib/progress'
import { ErrorBox, Loading } from '../components/Loading.jsx'
import PlayerPanel from '../components/PlayerPanel.jsx'
import { SHOW_TIMESTAMPS, SHOW_VIDEO_TAB } from '../config'
import SummaryTab from '../components/SummaryTab.jsx'
import ReviewTab from '../components/ReviewTab.jsx'
import MindmapTab from '../components/MindmapTab.jsx'

const TABS = [
  ['video', 'الفيديو'],
  ['summary', 'الملخص'],
  ['review', 'المراجعة'],
  ['map', 'الخريطة'],
]

export default function Course() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const [loaded, setLoaded] = useState(null) // { id, course } ou { id, error }
  const [playing, setPlaying] = useState(null) // secondes du dernier saut demandé, null = lecteur fermé
  const playerRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchCourse(id), appliedSuggestions(id)])
      .then(([course, applied]) => {
        if (cancelled) return
        if (course) rememberCourse(course.id)
        setLoaded({ id, course: course && { ...course, applied } })
      })
      .catch((error) => !cancelled && setLoaded({ id, error }))
    return () => {
      cancelled = true
    }
  }, [id])

  if (loaded?.id !== id) return <Loading />
  if (loaded.error) return <ErrorBox error={loaded.error} />
  const course = loaded.course
  if (course === null) {
    return (
      <div className="notice">
        <p>هذا الدرس غير موجود أو لم يُنشر بعد.</p>
        <Link to="/">العودة إلى الرئيسية</Link>
      </div>
    )
  }

  const videoId = youtubeId(course)
  const tabs = videoId && SHOW_VIDEO_TAB ? TABS : TABS.filter(([k]) => k !== 'video')
  const tab = tabs.some(([k]) => k === params.get('tab')) ? params.get('tab') : tabs[0][0]
  const select = (key) => setParams({ tab: key }, { replace: true })

  const seek = (seconds) => {
    if (!videoId || !SHOW_TIMESTAMPS) return
    const player = playerRef.current
    if (player?.seekTo) {
      player.seekTo(seconds, true)
      player.playVideo?.()
    }
    setPlaying(seconds) // monte le panneau au premier clic (le lecteur démarre à cet instant)
    if (SHOW_VIDEO_TAB) select('video')
  }

  return (
    <>
      <nav className="crumbs">
        <Link to={`/?s=${course.subject_id}`}>{course.subject_name}</Link>
        <span>/</span>
        <span>الدرس {course.number ?? ''}</span>
      </nav>
      <header className="course-head">
        <h1>{course.title}</h1>
        <p className="meta">
          {course.teacher && <span>{course.teacher}</span>}
          {course.date && <span>{course.date}</span>}
          {course.duration && <span>{course.duration}</span>}
          <span>{course.cards.length} بطاقة</span>
          {course.applied > 0 && <span title="اقتراحات من الطلبة طُبّقت على هذا الدرس">✎ {course.applied} تصحيح من الطلبة</span>}
        </p>
      </header>

      <div className="tabs" role="tablist">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            className={`tab ${tab === key ? 'active' : ''}`}
            onClick={() => select(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {playing !== null && videoId && (
        <PlayerPanel videoId={videoId} startAt={playing} playerRef={playerRef} onClose={() => setPlaying(null)} />
      )}

      <p className="contrib-note small muted">
        هذا المحتوى من إعداد الطلبة وقد يحتوي أخطاء. لاحظت خطأ أو لديك إضافة؟ استعمل زر «اقترح تصحيحا» في كل جزء.{' '}
        <Link to="/contribute">كيف تساهم؟</Link>
      </p>
      <section className="panel" role="tabpanel">
        {tab === 'summary' && <SummaryTab courseId={course.id} markdown={course.summary_md} videoId={videoId} chapters={course.chapters} onSeek={seek} />}
        {tab === 'review' && <ReviewTab courseId={course.id} cards={course.cards} />}
        {tab === 'map' && (
          <MindmapTab tree={course.mindmap} rootLabel={`الدرس ${course.number ?? ''} · ${course.title}`} courseId={course.id} />
        )}
      </section>
    </>
  )
}
