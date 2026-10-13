import { useEffect, useRef } from 'react'
import { loadYouTubeApi } from '../lib/youtube'
import { formatSeconds } from '../lib/arabic'

/**
 * Lecteur YouTube + chapitres. Reste monté (caché) quand un autre onglet est actif,
 * pour que les horodatages du résumé puissent faire sauter la lecture sans recharger.
 * playerRef.current reçoit l'objet YT.Player une fois prêt.
 */
export default function VideoTab({ videoId, chapters, playerRef, hidden, onSeek }) {
  const mount = useRef(null)

  useEffect(() => {
    let player = null
    let cancelled = false
    loadYouTubeApi().then((YT) => {
      if (cancelled || !mount.current) return
      player = new YT.Player(mount.current, {
        videoId,
        playerVars: { rel: 0, hl: 'ar', playsinline: 1 },
        events: { onReady: () => (playerRef.current = player) },
      })
    })
    return () => {
      cancelled = true
      playerRef.current = null
      player?.destroy()
    }
  }, [videoId, playerRef])

  return (
    <section className={hidden ? 'hidden' : ''} aria-hidden={hidden}>
      <div className="video-frame">
        <div ref={mount} />
      </div>
      {chapters.length > 0 && (
        <ol className="chapters">
          {chapters.map((ch) => (
            <li key={ch.seconds}>
              <button className="ts" onClick={() => onSeek(ch.seconds)}>
                {formatSeconds(ch.seconds)}
              </button>
              <span>{ch.title}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="small muted">
        <a href={`https://youtu.be/${videoId}`} target="_blank" rel="noreferrer">
          فتح الفيديو في يوتيوب ↗
        </a>
      </p>
    </section>
  )
}
