import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { fetchCourse } from '../lib/api'
import { youtubeId } from '../lib/arabic'
import { rememberCourse } from '../lib/progress'
import { ErrorBox, Loading } from '../components/Loading.jsx'
import PlayerPanel from '../components/PlayerPanel.jsx'
import SummaryTab from '../components/SummaryTab.jsx'
import ReviewTab from '../components/ReviewTab.jsx'
import MindmapTab from '../components/MindmapTab.jsx'

// L'onglet vidéo est désactivé pour l'instant (demande du 2026-10-13) : la vidéo ne
// s'affiche qu'à la demande, depuis un horodatage du résumé, dans un panneau repliable.
const SHOW_VIDEO_TAB = false
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
    fetchCourse(id)
      .then((course) => {
        if (cancelled) return
        if (course) rememberCourse(course.id)
        setLoaded({ id, course })
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
    if (!videoId) return
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

      <section className="panel" role="tabpanel">
        {tab === 'summary' && <SummaryTab markdown={course.summary_md} videoId={videoId} chapters={course.chapters} onSeek={seek} />}
        {tab === 'review' && <ReviewTab courseId={course.id} cards={course.cards} />}
        {tab === 'map' && <MindmapTab tree={course.mindmap} />}
      </section>
    </>
  )
}
