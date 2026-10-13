import { useEffect, useRef } from 'react'
import { loadYouTubeApi } from '../lib/youtube'
import { formatSeconds } from '../lib/arabic'

/**
 * Lecteur YouTube replié par défaut : il n'apparaît que lorsqu'on clique un horodatage
 * du résumé, et reste monté ensuite pour que les clics suivants fassent un simple seekTo.
 * playerRef.current reçoit l'objet YT.Player une fois prêt.
 */
export default function PlayerPanel({ videoId, startAt, playerRef, onClose }) {
  const mount = useRef(null)

  useEffect(() => {
    let player = null
    let cancelled = false
    loadYouTubeApi().then((YT) => {
      if (cancelled || !mount.current) return
      player = new YT.Player(mount.current, {
        videoId,
        playerVars: { rel: 0, hl: 'ar', playsinline: 1, autoplay: 1, start: Math.floor(startAt) },
        events: { onReady: () => (playerRef.current = player) },
      })
    })
    return () => {
      cancelled = true
      playerRef.current = null
      player?.destroy()
    }
    // startAt n'est lu qu'au montage : les sauts suivants passent par playerRef.seekTo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, playerRef])

  return (
    <aside className="player-panel" aria-label="مقطع الفيديو">
      <div className="player-head">
        <span className="small muted">الفيديو من {formatSeconds(startAt)}</span>
        <button className="tbtn" onClick={onClose} aria-label="إغلاق الفيديو">
          إغلاق ✕
        </button>
      </div>
      <div className="video-frame">
        <div ref={mount} />
      </div>
      <p className="small muted">
        <a href={`https://youtu.be/${videoId}?t=${Math.floor(startAt)}`} target="_blank" rel="noreferrer">
          فتح في يوتيوب ↗
        </a>
      </p>
    </aside>
  )
}
