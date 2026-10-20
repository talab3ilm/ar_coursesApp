import { useEffect, useMemo, useRef, useState } from 'react'
import MindmapTab from '../components/MindmapTab.jsx'
import { parseMindmap, saveMindmap, uploadFile } from '../lib/admin'

// Constructeur de carte mentale (/admin) : édite l'arbre JSON canonique dans le navigateur,
// nœud = { t, n?, d: [[tag, texte, source]], q: [[question, réponse]], k: [enfants] }.
const TAGS = [
  ['def', 'تعريف'],
  ['key', 'خلاصة'],
  ['ex', 'مثال'],
  ['diff', 'فرق'],
  ['link', 'رابط'],
  ['warn', 'تنبيه'],
  ['nass', 'نص'],
]
const DRAFT_KEY = (id) => `ar_coursesApp.builder.${id}`

const node = (t = '') => ({ t })
const getAt = (tree, path) => path.reduce((n, i) => n.k[i], tree)

/** Copie de l'arbre avec le nœud en `path` remplacé par `fn(nœud)` (null = suppression). */
function updateAt(tree, path, fn) {
  if (path.length === 0) return fn(tree)
  const [i, ...rest] = path
  const kids = [...(tree.k ?? [])]
  const next = updateAt(kids[i], rest, fn)
  if (next === null) kids.splice(i, 1)
  else kids[i] = next
  return { ...tree, k: kids }
}

/** Nettoie un nœud pour le fichier : retire les clés vides, garde l'ordre t, n, d, q, k. */
function clean(n) {
  const out = { t: (n.t ?? '').trim() }
  if (n.n && String(n.n).trim()) out.n = String(n.n).trim()
  const d = (n.d ?? []).filter((x) => x[1]?.trim()).map(([tag, text, src]) => [tag || 'def', text.trim(), (src ?? '').trim()])
  if (d.length) out.d = d
  const q = (n.q ?? []).filter((x) => x[0]?.trim()).map(([a, b]) => [a.trim(), (b ?? '').trim()])
  if (q.length) out.q = q
  const k = (n.k ?? []).map(clean)
  if (k.length) out.k = k
  return out
}

/**
 * Ajout rapide : une ligne = un fils, l'indentation (deux espaces ou une tabulation) = un sous-niveau,
 * « 1. » en tête = numéro, « ? question = réponse » = question du nœud précédent, « = texte » = définition.
 */
function parseOutline(text) {
  const roots = []
  const stack = [] // [{ depth, node }]
  for (const raw of text.split('\n')) {
    if (!raw.trim()) continue
    const indent = raw.match(/^[\t ]*/)[0]
    const depth = indent.replace(/\t/g, '  ').length / 2
    let line = raw.trim().replace(/^[-*•]\s*/, '')
    const last = stack[stack.length - 1]
    if (line.startsWith('?') && last) {
      const [q, ...a] = line.slice(1).split('=')
      last.node.q = [...(last.node.q ?? []), [q.trim(), a.join('=').trim()]]
      continue
    }
    if (line.startsWith('=') && last) {
      last.node.d = [...(last.node.d ?? []), ['def', line.slice(1).trim(), '']]
      continue
    }
    const n = node()
    const num = line.match(/^(\d+)[.)]\s+(.*)$/)
    if (num) {
      n.n = num[1]
      line = num[2]
    }
    n.t = line
    while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop()
    const parent = stack[stack.length - 1]
    if (parent) parent.node.k = [...(parent.node.k ?? []), n]
    else roots.push(n)
    stack.push({ depth, node: n })
  }
  return roots
}

const download = (name, text) => {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

/** Ligne du plan : titre cliquable, puis ses enfants. */
function Outline({ n, path, sel, onSelect }) {
  const here = path.join('/')
  const kids = n.k ?? []
  return (
    <li>
      <button className={`ol-node ${sel === here ? 'selected' : ''}`} onClick={() => onSelect(path)}>
        {n.n && <span className="num">{n.n}</span>}
        <span className="ol-title">{n.t?.trim() || '(بلا عنوان)'}</span>
        {(n.d?.length > 0 || n.q?.length > 0) && (
          <span className="ol-meta">
            {n.d?.length ? `${n.d.length} ش` : ''} {n.q?.length ? `${n.q.length} س` : ''}
          </span>
        )}
      </button>
      {kids.length > 0 && (
        <ul>
          {kids.map((c, i) => (
            <Outline key={i} n={c} path={[...path, i]} sel={sel} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </li>
  )
}

export default function MindmapBuilder({ courseId, subjectId, title, initialTree, managedBy, onSaved }) {
  const [tree, setTree] = useState(() => initialTree ?? node(title || ''))
  const [path, setPath] = useState([])
  const [mode, setMode] = useState('edit') // 'edit' | 'preview'
  const [quick, setQuick] = useState('')
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState(null) // brouillon trouvé au chargement
  const [focusTick, setFocusTick] = useState(0) // incrémenté pour placer le curseur dans le titre après le rendu
  const titleRef = useRef(null)
  const fileRef = useRef(null)
  useEffect(() => {
    if (focusTick) titleRef.current?.focus()
  }, [focusTick])

  // Brouillon dans le navigateur : proposé à l'ouverture s'il diffère de la base, enregistré à chaque changement.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY(courseId))
      if (saved && saved !== JSON.stringify(initialTree ?? node(title || ''))) setDraft(JSON.parse(saved))
    } catch {
      /* brouillon illisible : ignoré */
    }
  }, [courseId, initialTree, title])
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY(courseId), JSON.stringify(tree))
    } catch {
      /* stockage indisponible */
    }
  }, [tree, courseId])

  const current = useMemo(() => {
    try {
      return getAt(tree, path)
    } catch {
      return tree
    }
  }, [tree, path])
  const sel = path.join('/')
  const isRoot = path.length === 0
  const parentPath = path.slice(0, -1)
  const idx = path[path.length - 1]
  const siblings = isRoot ? [] : getAt(tree, parentPath).k ?? []
  const cleaned = useMemo(() => clean(tree), [tree])
  const forPreview = useMemo(() => {
    const label = (n, i) => ({ ...n, t: n.t || `(بلا عنوان ${i + 1})`, k: (n.k ?? []).map(label) })
    return label(cleaned, 0)
  }, [cleaned])
  const count = useMemo(() => {
    let c = 0
    const walk = (n) => {
      c++
      ;(n.k ?? []).forEach(walk)
    }
    walk(tree)
    return c
  }, [tree])

  const edit = (fn) => setTree((t) => updateAt(t, path, (n) => fn({ ...n })))
  const setField = (k) => (e) => edit((n) => ({ ...n, [k]: e.target.value }))

  const addChild = () => {
    const kids = current.k ?? []
    edit((n) => ({ ...n, k: [...kids, node()] }))
    setPath([...path, kids.length])
    setFocusTick((k) => k + 1)
  }
  const addSibling = () => {
    if (isRoot) return addChild()
    setTree((t) =>
      updateAt(t, parentPath, (p) => {
        const kids = [...(p.k ?? [])]
        kids.splice(idx + 1, 0, node())
        return { ...p, k: kids }
      }),
    )
    setPath([...parentPath, idx + 1])
    setFocusTick((k) => k + 1)
  }
  const move = (delta) => {
    const to = idx + delta
    if (isRoot || to < 0 || to >= siblings.length) return
    setTree((t) =>
      updateAt(t, parentPath, (p) => {
        const kids = [...p.k]
        ;[kids[idx], kids[to]] = [kids[to], kids[idx]]
        return { ...p, k: kids }
      }),
    )
    setPath([...parentPath, to])
  }
  /** Rentre le nœud sous son frère précédent (comme Tab dans un plan). */
  const indent = () => {
    if (isRoot || idx === 0) return
    const me = current
    setTree((t) =>
      updateAt(t, parentPath, (p) => {
        const kids = [...p.k]
        kids.splice(idx, 1)
        const prev = { ...kids[idx - 1], k: [...(kids[idx - 1].k ?? []), me] }
        kids[idx - 1] = prev
        return { ...p, k: kids }
      }),
    )
    setPath([...parentPath, idx - 1, (siblings[idx - 1].k ?? []).length])
  }
  /** Sort le nœud au niveau de son parent, juste après lui. */
  const outdent = () => {
    if (path.length < 2) return
    const me = current
    const gp = parentPath.slice(0, -1)
    const pIdx = parentPath[parentPath.length - 1]
    setTree((t) =>
      updateAt(t, gp, (g) => {
        const kids = [...g.k]
        const parent = { ...kids[pIdx], k: kids[pIdx].k.filter((_, i) => i !== idx) }
        kids[pIdx] = parent
        kids.splice(pIdx + 1, 0, me)
        return { ...g, k: kids }
      }),
    )
    setPath([...gp, pIdx + 1])
  }
  const remove = () => {
    if (isRoot) return
    const n = (current.k ?? []).length
    if (n && !window.confirm(`حذف « ${current.t} » وفروعه (${n})؟`)) return
    setTree((t) => updateAt(t, path, () => null))
    setPath(parentPath)
  }

  const setRow = (key, i, j, value) =>
    edit((n) => {
      const rows = (n[key] ?? []).map((r) => [...r])
      rows[i][j] = value
      return { ...n, [key]: rows }
    })
  const addRow = (key, empty) => edit((n) => ({ ...n, [key]: [...(n[key] ?? []), empty] }))
  const delRow = (key, i) => edit((n) => ({ ...n, [key]: (n[key] ?? []).filter((_, k) => k !== i) }))

  const addQuick = () => {
    const nodes = parseOutline(quick)
    if (!nodes.length) return
    edit((n) => ({ ...n, k: [...(n.k ?? []), ...nodes] }))
    setQuick('')
  }

  const importFile = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try {
      setTree(parseMindmap(await f.text()))
      setPath([])
      setStatus({ ok: true, text: `تم استيراد ${f.name}.` })
    } catch (err) {
      setStatus({ ok: false, text: `ملف غير صالح : ${err.message}` })
    }
  }

  const reset = () => {
    if (!window.confirm('بدء خريطة جديدة فارغة؟ سيُفقد ما لم يُحفظ.')) return
    setTree(node(title || ''))
    setPath([])
  }

  const save = async () => {
    if (!cleaned.t) return setStatus({ ok: false, text: 'عنوان الجذر مطلوب.' })
    setBusy(true)
    setStatus(null)
    try {
      const text = JSON.stringify(cleaned, null, 2)
      await saveMindmap(courseId, cleaned)
      await uploadFile(subjectId, courseId, 'mindmap.json', text, 'application/json')
      localStorage.removeItem(DRAFT_KEY(courseId))
      setStatus({
        ok: true,
        text:
          'حُفظت الخريطة في القاعدة. نزّل mindmap-ok.json وضعه في مجلد الدرس في المستودع حتى لا يستبدلها النشر الآلي' +
          (managedBy === 'manual' ? '.' : ' (أو ثبّت الدرس يدويا).'),
      })
      onSaved?.()
    } catch (err) {
      setStatus({ ok: false, text: `فشل الحفظ : ${err.message}` })
    }
    setBusy(false)
  }

  // Clic sur un nœud de l'aperçu : on retrouve son chemin d'indices à partir de ses titres.
  const pick = (titles) => {
    const p = []
    let n = tree
    for (const t of titles.slice(1)) {
      const i = (n.k ?? []).findIndex((c, j) => (c.t?.trim() || `(بلا عنوان ${j + 1})`) === t)
      if (i < 0) break
      p.push(i)
      n = n.k[i]
    }
    setPath(p)
    setMode('edit')
  }

  const onTitleKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addSibling()
    } else if (e.key === 'Tab' && !e.shiftKey && !isRoot) {
      e.preventDefault()
      indent()
    } else if (e.key === 'Tab' && e.shiftKey && path.length > 1) {
      e.preventDefault()
      outdent()
    }
  }

  return (
    <section className="builder">
      <header className="admin-head">
        <h2>منشئ الخريطة الذهنية</h2>
        <span className="small muted">{count} عقدة</span>
      </header>
      {draft && (
        <div className="notice notice-warn small">
          <p>
            توجد مسودة غير محفوظة في هذا المتصفح.{' '}
            <button
              className="tbtn"
              onClick={() => {
                setTree(draft)
                setPath([])
                setDraft(null)
              }}
            >
              استعادة المسودة
            </button>{' '}
            <button className="tbtn" onClick={() => setDraft(null)}>
              تجاهل
            </button>
          </p>
        </div>
      )}

      <div className="toolbar">
        <div className="seg" role="group" aria-label="الوضع">
          <button aria-pressed={mode === 'edit'} onClick={() => setMode('edit')}>
            تحرير
          </button>
          <button aria-pressed={mode === 'preview'} onClick={() => setMode('preview')}>
            معاينة
          </button>
        </div>
        <button className="tbtn" onClick={() => fileRef.current?.click()}>
          استيراد ملف
        </button>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={importFile} />
        <button className="tbtn" onClick={() => download('mindmap-ok.json', JSON.stringify(cleaned, null, 2))}>
          تنزيل mindmap-ok.json
        </button>
        <button className="tbtn" onClick={reset}>
          خريطة جديدة
        </button>
      </div>

      {mode === 'preview' ? (
        <div className="panel preview">
          <p className="small muted">انقر عقدة لتحريرها.</p>
          <MindmapTab key={JSON.stringify(forPreview)} tree={forPreview} onPick={pick} />
        </div>
      ) : (
        <div className="builder-grid">
          <nav className="panel outline" aria-label="الهيكل">
            <ul className="ol">
              <Outline n={tree} path={[]} sel={sel} onSelect={setPath} />
            </ul>
          </nav>

          <div className="panel node-editor">
            <div className="row node-actions">
              <button className="tbtn" onClick={addChild} title="إضافة فرع تحت هذه العقدة">
                + فرع
              </button>
              <button className="tbtn" onClick={addSibling} disabled={isRoot} title="إضافة عقدة بعد هذه (Enter)">
                + أخ
              </button>
              <button className="tbtn" onClick={() => move(-1)} disabled={isRoot || idx === 0} title="تقديم">
                ↑
              </button>
              <button className="tbtn" onClick={() => move(1)} disabled={isRoot || idx >= siblings.length - 1} title="تأخير">
                ↓
              </button>
              <button className="tbtn" onClick={indent} disabled={isRoot || idx === 0} title="إدخال تحت السابق (Tab)">
                ⇥ إدخال
              </button>
              <button className="tbtn" onClick={outdent} disabled={path.length < 2} title="إخراج إلى مستوى الأب (Shift+Tab)">
                ⇤ إخراج
              </button>
              <button className="tbtn danger" onClick={remove} disabled={isRoot}>
                حذف
              </button>
            </div>

            <div className="form-grid node-fields">
              <label className="wide">
                {isRoot ? 'عنوان الخريطة (الجذر)' : 'العنوان'}
                <input ref={titleRef} value={current.t ?? ''} onChange={setField('t')} onKeyDown={onTitleKey} />
              </label>
              {!isRoot && (
                <label>
                  الرقم (اختياري)
                  <input value={current.n ?? ''} onChange={setField('n')} placeholder="مثل 1 أو أ" />
                </label>
              )}
            </div>

            <h3>الشرح</h3>
            {(current.d ?? []).map((d, i) => (
              <div key={i} className="row-item">
                <select value={d[0]} onChange={(e) => setRow('d', i, 0, e.target.value)} aria-label="النوع">
                  {TAGS.map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
                <textarea rows={2} value={d[1]} onChange={(e) => setRow('d', i, 1, e.target.value)} placeholder="النص" />
                <input className="src" value={d[2] ?? ''} onChange={(e) => setRow('d', i, 2, e.target.value)} placeholder="ص" title="المصدر: رقم الصفحة، أو خ (الخريطة)، أو + (إضافة)" />
                <button className="tbtn" onClick={() => delRow('d', i)} aria-label="حذف">
                  ✕
                </button>
              </div>
            ))}
            <button className="tbtn" onClick={() => addRow('d', ['def', '', ''])}>
              + شرح
            </button>

            <h3>الأسئلة</h3>
            {(current.q ?? []).map((q, i) => (
              <div key={i} className="row-item q">
                <textarea rows={2} value={q[0]} onChange={(e) => setRow('q', i, 0, e.target.value)} placeholder="السؤال" />
                <textarea rows={2} value={q[1] ?? ''} onChange={(e) => setRow('q', i, 1, e.target.value)} placeholder="الجواب" />
                <button className="tbtn" onClick={() => delRow('q', i)} aria-label="حذف">
                  ✕
                </button>
              </div>
            ))}
            <button className="tbtn" onClick={() => addRow('q', ['', ''])}>
              + سؤال
            </button>

            <details className="quick">
              <summary>إضافة فروع من نص</summary>
              <p className="small muted">
                كل سطر فرع تحت « {current.t?.trim() || 'هذه العقدة'} »؛ مسافتان في أول السطر = مستوى أدنى؛ « 1. » في أوله = رقم؛ سطر
                يبدأ بـ « ? » = سؤال (الجواب بعد « = »)؛ سطر يبدأ بـ « = » = شرح.
              </p>
              <textarea
                rows={6}
                dir="rtl"
                value={quick}
                onChange={(e) => setQuick(e.target.value)}
                placeholder={'1. الحد\n  = التعريف اللغوي…\n  ? ما الحد؟ = هو…\n2. الأقسام\n  القسم الأول\n  القسم الثاني'}
              />
              <button className="tbtn" onClick={addQuick} disabled={!quick.trim()}>
                إضافة
              </button>
            </details>
          </div>
        </div>
      )}

      <div className="row actions">
        <button className="btn" onClick={save} disabled={busy}>
          حفظ الخريطة في القاعدة
        </button>
      </div>
      {status && (
        <p className={status.ok ? 'ok' : 'ko'} role="status">
          {status.text}
        </p>
      )}
    </section>
  )
}
