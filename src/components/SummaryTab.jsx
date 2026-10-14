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

/** Découpe un texte aux titres du niveau donné ; la première part, sans titre, précède le premier titre. */
function splitAt(md, level) {
  const re = new RegExp(`^${'#'.repeat(level)}\\s+(.*?)\\s*$`)
  const parts = []
  let current = { title: null, seconds: null, body: [] }
  for (const line of md.split('\n')) {
    const m = re.exec(line)
    if (m) {
      parts.push(current)
      const ts = MARKER.exec(m[1])
      MARKER.lastIndex = 0
      current = { title: m[1].replace(MARKER, '').trim(), seconds: ts ? parseTimestamp(ts[1]) : null, body: [] }
    } else {
      current.body.push(line)
    }
  }
  parts.push(current)
  return parts.filter((s) => s.title !== null || s.body.join('').trim()).map((s) => ({ ...s, body: s.body.join('\n') }))
}

/**
 * Sections de niveau 2 (accordéons), chacune découpée en sous-sections de niveau 3 (accordéons imbriqués).
 * La première section, sans titre, est l'introduction ; dans une section, le texte avant le premier ### reste visible.
 */
function splitSections(md) {
  return splitAt(md, 2).map((s) => {
    if (s.title === null) return { ...s, subs: [] }
    const [first, ...rest] = splitAt(s.body, 3)
    if (first && first.title === null) return { ...s, body: first.body, subs: rest }
    return { ...s, body: '', subs: first ? [first, ...rest] : [] }
  })
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

  // Clés d'ouverture : "i" pour une section, "i/j" pour une sous-section.
  const titled = sections.map((s, i) => [s, i]).filter(([s]) => s.title !== null)
  const allKeys = titled.flatMap(([s, i]) => [String(i), ...s.subs.map((_, j) => `${i}/${j}`)])
  const toggle = (k) => {
    const next = new Set(open)
    if (next.has(k)) next.delete(k)
    else next.add(k)
    setOpen(next)
  }
  const render = (md) => (
    <Markdown remarkPlugins={[remarkGfm, remarkBreaks, remarkQuran]} components={components}>
      {withTimestampLinks(md)}
    </Markdown>
  )
  const seek = (seconds) =>
    SHOW_TIMESTAMPS && videoId && seconds !== null ? (
      <button type="button" className="ts" onClick={() => onSeek(seconds)}>
        ⏱ {formatSeconds(seconds)}
      </button>
    ) : null
  const head = (Tag, k, s) => (
    <Tag className="acc-head">
      <button type="button" className="acc-toggle" aria-expanded={open.has(k)} onClick={() => toggle(k)}>
        <span className="chev" aria-hidden="true">{open.has(k) ? '▾' : '◂'}</span>
        {s.title}
      </button>
      {seek(s.seconds)}
    </Tag>
  )
  const openCount = titled.filter(([, i]) => open.has(String(i))).length

  return (
    <article className="prose summary">
      {titled.length > 0 && (
        <div className="toolbar">
          <button className="tbtn" onClick={() => setOpen(new Set(allKeys))}>
            فتح الكل
          </button>
          <button className="tbtn" onClick={() => setOpen(new Set())}>
            طي الكل
          </button>
          <span className="small muted">{openCount} / {titled.length} مفتوح</span>
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
          <section key={i} className={`acc ${open.has(String(i)) ? 'open' : ''}`}>
            {head('h2', String(i), s)}
            {open.has(String(i)) && (
              <div className="acc-body">
                {s.body.trim() && render(s.body)}
                {s.subs.map((sub, j) => {
                  const k = `${i}/${j}`
                  return (
                    <section key={k} className={`acc sub ${open.has(k) ? 'open' : ''}`}>
                      {head('h3', k, sub)}
                      {open.has(k) && <div className="acc-body">{render(sub.body)}</div>}
                    </section>
                  )
                })}
              </div>
            )}
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
