import { useMemo } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { formatSeconds, parseTimestamp } from '../lib/arabic'

// Marqueur [mm:ss] ou [h:mm:ss] du pipeline -> lien interne #t=<secondes>, rendu en bouton.
const MARKER = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g
// Frontmatter YAML éventuel (déjà retiré par publish.py, gardé par sécurité pour l'admin).
const FRONTMATTER = /^---\s*\n[\s\S]*?\n---[ \t]*\n?/

function withTimestampLinks(md) {
  return md.replace(FRONTMATTER, '').replace(MARKER, (_, ts) => {
    const s = parseTimestamp(ts)
    return s === null ? _ : `[${ts}](#t=${s})`
  })
}

export default function SummaryTab({ markdown, videoId, chapters = [], onSeek }) {
  const source = useMemo(() => withTimestampLinks(markdown ?? ''), [markdown])

  const components = {
    a: ({ href, children }) => {
      const m = href?.match(/^#t=(\d+)$/)
      if (!m) {
        return (
          <a href={href} target="_blank" rel="noreferrer">
            {children}
          </a>
        )
      }
      const seconds = Number(m[1])
      return (
        <button
          type="button"
          className="ts"
          title="الانتقال إلى هذه اللحظة في الفيديو"
          onClick={() => onSeek(seconds)}
        >
          ⏱ {formatSeconds(seconds)}
        </button>
      )
    },
  }

  if (!markdown) return <p className="muted">لا يوجد ملخّص لهذا الدرس بعد.</p>

  return (
    <article className="prose summary">
      {videoId && chapters.length > 0 && (
        <nav className="toc" aria-label="محتويات الدرس">
          <p className="small muted">انقر على الوقت لمشاهدة المقطع داخل الصفحة.</p>
          <ol>
            {chapters.map((ch) => (
              <li key={ch.seconds}>
                <button className="ts" onClick={() => onSeek(ch.seconds)}>
                  {formatSeconds(ch.seconds)}
                </button>
                <span>{ch.title}</span>
              </li>
            ))}
          </ol>
        </nav>
      )}
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </Markdown>
      {videoId && (
        <p className="small muted">
          إن لم يعمل العرض داخل الصفحة، افتح{' '}
          <a href={`https://youtu.be/${videoId}`} target="_blank" rel="noreferrer">
            الفيديو في يوتيوب
          </a>
          .
        </p>
      )}
    </article>
  )
}
