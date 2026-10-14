import { useMemo, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks' // un retour à la ligne simple = <br> (vers, hémistiches)
import { formatSeconds, parseTimestamp } from '../lib/arabic'
import { SHOW_TIMESTAMPS } from '../config'
import { remarkQuran } from '../lib/quran.jsx'

// Marqueur [mm:ss] ou [h:mm:ss] du pipeline -> lien interne #t=<secondes>, rendu en bouton.
const MARKER = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g
// Frontmatter YAML éventuel (déjà retiré par publish.py, gardé par sécurité pour l'admin).
const FRONTMATTER = /^---\s*\n[\s\S]*?\n---[ \t]*\n?/

function withTimestampLinks(md) {
  if (!SHOW_TIMESTAMPS) return md.replace(MARKER, '') // marqueurs retirés de l'affichage
  return md.replace(MARKER, (_, ts) => {
    const s = parseTimestamp(ts)
    return s === null ? _ : `[${ts}](#t=${s})`
  })
}

/** Découpe le résumé en sections de niveau 2 (accordéons) ; la première, sans titre, est l'introduction. */
function splitSections(md) {
  const sections = []
  let current = { title: null, seconds: null, body: [] }
  for (const line of md.split('\n')) {
    const m = /^##\s+(.*?)\s*$/.exec(line)
    if (m) {
      sections.push(current)
      const ts = MARKER.exec(m[1])
      MARKER.lastIndex = 0
      current = { title: m[1].replace(MARKER, '').trim(), seconds: ts ? parseTimestamp(ts[1]) : null, body: [] }
    } else {
      current.body.push(line)
    }
  }
  sections.push(current)
  return sections.filter((s) => s.title !== null || s.body.join('').trim()).map((s) => ({ ...s, body: s.body.join('\n') }))
}

export default function SummaryTab({ markdown, videoId, chapters = [], onSeek }) {
  const sections = useMemo(() => splitSections((markdown ?? '').replace(FRONTMATTER, '')), [markdown])
  const [open, setOpen] = useState(() => new Set())

  const components = useMemo(
    () => ({
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
          <button type="button" className="ts" title="الانتقال إلى هذه اللحظة في الفيديو" onClick={() => onSeek(seconds)}>
            ⏱ {formatSeconds(seconds)}
          </button>
        )
      },
    }),
    [onSeek],
  )

  if (!markdown) return <p className="muted">لا يوجد ملخّص لهذا الدرس بعد.</p>

  const titled = sections.map((s, i) => [s, i]).filter(([s]) => s.title !== null)
  const toggle = (i) => {
    const next = new Set(open)
    if (next.has(i)) next.delete(i)
    else next.add(i)
    setOpen(next)
  }
  const render = (md) => (
    <Markdown remarkPlugins={[remarkGfm, remarkBreaks, remarkQuran]} components={components}>
      {withTimestampLinks(md)}
    </Markdown>
  )

  return (
    <article className="prose summary">
      {titled.length > 0 && (
        <div className="toolbar">
          <button className="tbtn" onClick={() => setOpen(new Set(titled.map(([, i]) => i)))}>
            فتح الكل
          </button>
          <button className="tbtn" onClick={() => setOpen(new Set())}>
            طي الكل
          </button>
          <span className="small muted">{open.size} / {titled.length} مفتوح</span>
        </div>
      )}
      {SHOW_TIMESTAMPS && videoId && chapters.length > 0 && (
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
      {sections.map((s, i) =>
        s.title === null ? (
          <div key={i} className="intro">
            {render(s.body)}
          </div>
        ) : (
          <section key={i} className={`acc ${open.has(i) ? 'open' : ''}`}>
            <h2 className="acc-head">
              <button type="button" className="acc-toggle" aria-expanded={open.has(i)} onClick={() => toggle(i)}>
                <span className="chev" aria-hidden="true">{open.has(i) ? '▾' : '◂'}</span>
                {s.title}
              </button>
              {SHOW_TIMESTAMPS && videoId && s.seconds !== null && (
                <button type="button" className="ts" onClick={() => onSeek(s.seconds)}>
                  ⏱ {formatSeconds(s.seconds)}
                </button>
              )}
            </h2>
            {open.has(i) && <div className="acc-body">{render(s.body)}</div>}
          </section>
        ),
      )}
      {SHOW_TIMESTAMPS && videoId && (
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
