import { useMemo, useState } from 'react'
import { matches } from '../lib/arabic'

// Libellés et couleurs des tags de `d`, repris de miniApp.html.
const TAGS = {
  def: ['تعريف', 'var(--b4)'],
  key: ['خلاصة', 'var(--accent)'],
  ex: ['مثال', 'var(--b5)'],
  diff: ['فرق', 'var(--b3)'],
  link: ['رابط', 'var(--b6)'],
  warn: ['تنبيه', 'var(--b2)'],
  nass: ['نص', 'var(--gold)'],
}
const COLORS = ['--b1', '--b4', '--b2', '--b5', '--b3', '--b6']
const SEP = ' ‹ '

/**
 * Aplatit l'arbre. L'identifiant d'un nœud est le chemin de ses titres : stable tant que
 * les titres ne changent pas, contrairement à l'indice de parcours de miniApp.
 */
function index(tree) {
  const nodes = []
  const byId = new Map()
  const walk = (node, depth, parent, color, path) => {
    const id = [...path, node.t].join(SEP)
    const entry = { ...node, id, depth, parent, color, path, kids: [], d: node.d ?? [], q: node.q ?? [] }
    nodes.push(entry)
    byId.set(id, entry)
    const before = nodes.length
    ;(node.k ?? []).forEach((child, i) => {
      const c = depth === 0 ? COLORS[i % COLORS.length] : color
      entry.kids.push(walk(child, depth + 1, id, c, [...path, node.t]))
    })
    entry.count = nodes.length - before
    return entry
  }
  const root = walk(tree, 0, null, '--accent', [])
  return { nodes, byId, root }
}

const haystack = (n) => [n.t, ...n.d.map((d) => d[1]), ...n.q.flat()].join(' ')

function SourceChip({ src }) {
  if (src === 'خ') return <span className="src map">الخريطة</span>
  if (src === '+') return <span className="src add">إضافة</span>
  if (src) return <span className="src">ص {src}</span>
  return null
}

function QuestionCard({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="qcard">
      <p className="qq">
        <span className="tag" style={{ color: 'var(--accent)' }}>
          سؤال
        </span>{' '}
        {q}
      </p>
      {open && <p className="qa">{a}</p>}
      <button className="reveal" onClick={() => setOpen(!open)}>
        {open ? 'إخفاء الجواب' : 'إظهار الجواب'}
      </button>
    </div>
  )
}

function Detail({ node, onSelect }) {
  const empty = node.d.length === 0 && node.q.length === 0
  return (
    <aside className="detail" aria-live="polite">
      <p className="small muted">{node.path.length ? node.path.join(SEP) : 'الجذر'}</p>
      <h2>
        {node.n ? `${node.n}. ` : ''}
        {node.t}
      </h2>
      {empty && <p className="muted">فرع جامع: اختر أحد فروعه.</p>}
      {node.d.length > 0 && (
        <ul className="items">
          {node.d.map(([tag, text, src], i) => {
            const [label, color] = TAGS[tag] ?? [tag, 'var(--muted)']
            return (
              <li key={i}>
                <span className="h">
                  <span className="tag" style={{ color }}>
                    {label}
                  </span>
                  <SourceChip src={src} />
                </span>
                <p className={tag === 'nass' ? 'nass' : ''}>{text}</p>
              </li>
            )
          })}
        </ul>
      )}
      {node.q.map(([q, a], i) => (
        <QuestionCard key={i} q={q} a={a} />
      ))}
      {node.kids.length > 0 && (
        <div className="kidsnav">
          {node.kids.map((k) => (
            <button key={k.id} onClick={() => onSelect(k.id)}>
              {k.n ? `${k.n}. ` : ''}
              {k.t}
            </button>
          ))}
        </div>
      )}
    </aside>
  )
}

export default function MindmapTab({ tree }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [openedAll, setOpenedAll] = useState(false)
  const [overrides, setOverrides] = useState(() => new Map()) // id -> ouvert ?

  const indexed = useMemo(() => (tree ? index(tree) : null), [tree])

  // Nœuds trouvés par la recherche, et ancêtres à ouvrir (« open:<id> »).
  const hits = useMemo(() => {
    if (!indexed || !query.trim()) return null
    const set = new Set()
    indexed.nodes.forEach((n) => {
      if (!matches(haystack(n), query)) return
      set.add(n.id)
      for (let p = n.parent; p; p = indexed.byId.get(p).parent) set.add(`open:${p}`)
    })
    return set
  }, [indexed, query])

  if (!indexed) return <p className="muted">الخريطة الذهنية لهذا الدرس غير متوفرة بعد.</p>

  const { nodes, byId, root } = indexed
  const current = byId.get(selected) ?? root
  const hitCount = hits ? nodes.filter((n) => hits.has(n.id)).length : 0

  // Profondeurs 0 et 1 ouvertes par défaut ; la recherche ouvre les ancêtres des résultats.
  const isOpen = (n) => hits?.has(`open:${n.id}`) || (overrides.has(n.id) ? overrides.get(n.id) : openedAll || n.depth < 2)
  const setOpen = (n, open) => setOverrides((prev) => new Map(prev).set(n.id, open))

  const onNodeClick = (n) => {
    if (selected === n.id && n.kids.length) setOpen(n, !isOpen(n))
    else {
      setSelected(n.id)
      if (n.kids.length && !isOpen(n)) setOpen(n, true)
    }
  }
  const openAll = () => {
    setOverrides(new Map())
    setOpenedAll(true)
  }
  const closeAll = () => {
    setOpenedAll(false)
    setOverrides(new Map(nodes.filter((n) => n.depth >= 1 && n.kids.length).map((n) => [n.id, false])))
  }

  const renderNode = (n) => {
    const open = isOpen(n)
    const hit = hits?.has(n.id)
    const cls = ['node', `l${Math.min(n.depth, 2)}`]
    if (hit) cls.push('hit')
    if (hits && !hit) cls.push('dim')
    if (selected === n.id) cls.push('selected')
    if (n.kids.length === 0 && n.depth >= 2) cls.push('dot')
    return (
      <li key={n.id} style={{ '--c': `var(${n.color})` }}>
        <button className={cls.join(' ')} aria-expanded={n.kids.length ? open : undefined} onClick={() => onNodeClick(n)}>
          {n.n && n.depth >= 2 && <span className="num">{n.n}</span>}
          {n.t}
          {n.kids.length > 0 && <span className="cnt">{n.count}</span>}
        </button>
        {n.kids.length > 0 && open && <ul className="kids">{n.kids.map(renderNode)}</ul>}
      </li>
    )
  }

  return (
    <div className="mindmap">
      <div className="toolbar">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث عن مفهوم أو سؤال…"
          aria-label="بحث"
        />
        <button className="tbtn" onClick={openAll}>
          فتح الكل
        </button>
        <button className="tbtn" onClick={closeAll}>
          طي الكل
        </button>
        {hits && (
          <span className="small muted" role="status">
            {hitCount ? `${hitCount} نتيجة` : 'لا نتائج'}
          </span>
        )}
      </div>
      <div className="work">
        <section className="canvas" aria-label="الخريطة الذهنية">
          <ul className={`tree ${hits ? 'searching' : ''}`}>{renderNode(root)}</ul>
        </section>
        <Detail node={current} onSelect={setSelected} />
      </div>
      <p className="legend small muted">
        <span>ص 4 = صفحة ملف الدرس</span>
        <span>الخريطة = خريطة الأكاديمية</span>
        <span>إضافة = ليست في الدرس</span>
      </p>
    </div>
  )
}
