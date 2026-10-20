// Tableau de bord : authentification, lectures complètes et écritures (RLS : e-mail dans admins).
// Les analyses de fichiers reproduisent exactement tools/publish.py (guid, frontmatter, chapitres).
import { supabase } from './supabase'

const TASHKEEL = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g
const FRONTMATTER = /^---\s*\n[\s\S]*?\n---[ \t]*\n?/
const TIMESTAMP_HEADING = /^#{1,6}\s+(.*?)\s*\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]\s*$/

async function run(query) {
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data
}

// ---------- auth ----------
export const signIn = (email, password) => supabase.auth.signInWithPassword({ email, password })
export const signOut = () => supabase.auth.signOut()
export const getSession = async () => (await supabase.auth.getSession()).data.session
export const onAuth = (cb) => supabase.auth.onAuthStateChange((_e, session) => cb(session)).data.subscription

/** Vrai si l'utilisateur connecté est dans la liste blanche. */
export async function isAdmin() {
  const { data, error } = await supabase.rpc('is_admin')
  if (error) throw new Error(error.message)
  return data === true
}

// ---------- lectures complètes ----------
export const listSubjects = () => run(supabase.from('subjects').select('id, name_ar, position').order('position'))

export const listAllCourses = () =>
  run(
    supabase
      .from('courses')
      .select('id, subject_id, number, title, teacher, date, duration, youtube_url, published, managed_by, updated_at')
      .order('subject_id')
      .order('number'),
  )

export async function loadCourse(id) {
  const course = await run(supabase.from('courses').select('*').eq('id', id).maybeSingle())
  if (!course) return null
  const [cards, chapters, mindmap] = await Promise.all([
    run(supabase.from('cards').select('guid').eq('course_id', id)),
    run(supabase.from('chapters').select('seconds').eq('course_id', id)),
    run(supabase.from('mindmaps').select('course_id').eq('course_id', id).maybeSingle()),
  ])
  return { ...course, cardCount: cards.length, chapterCount: chapters.length, hasMindmap: !!mindmap }
}

// ---------- écritures ----------
export async function saveCourse(fields) {
  await run(supabase.from('courses').upsert({ ...fields, updated_at: new Date().toISOString() }, { onConflict: 'id' }))
}

export const setPublished = (id, published) =>
  run(supabase.from('courses').update({ published, updated_at: new Date().toISOString() }).eq('id', id))

export const setManaged = (id, managed_by) =>
  run(supabase.from('courses').update({ managed_by, updated_at: new Date().toISOString() }).eq('id', id))

export async function replaceCards(courseId, cards) {
  await run(supabase.from('cards').delete().eq('course_id', courseId))
  if (cards.length) await run(supabase.from('cards').insert(cards))
}

export async function replaceChapters(courseId, chapters) {
  await run(supabase.from('chapters').delete().eq('course_id', courseId))
  if (chapters.length) await run(supabase.from('chapters').insert(chapters))
}

/** Identifiants des cours qui ont une carte mentale en base. */
export const listMindmapIds = async () => new Set((await run(supabase.from('mindmaps').select('course_id'))).map((r) => r.course_id))

export const loadMindmap = async (courseId) =>
  (await run(supabase.from('mindmaps').select('tree').eq('course_id', courseId).maybeSingle()))?.tree ?? null

export const saveMindmap = (courseId, tree) => run(supabase.from('mindmaps').upsert({ course_id: courseId, tree }))

export async function uploadFile(subjectId, courseId, name, text, mime) {
  const { error } = await supabase.storage
    .from('content')
    .upload(`${subjectId}/${courseId}/${name}`, new Blob([text], { type: mime }), { upsert: true, contentType: mime })
  if (error) throw new Error(error.message)
}

export async function deleteCourse(id, subjectId) {
  await run(supabase.from('courses').delete().eq('id', id)) // cartes, chapitres, carte : cascade
  if (subjectId) {
    const { data } = await supabase.storage.from('content').list(`${subjectId}/${id}`)
    const names = (data ?? []).map((o) => `${subjectId}/${id}/${o.name}`)
    if (names.length) await supabase.storage.from('content').remove(names) // fichiers du bucket
  }
}

// ---------- analyses de fichiers (identiques à publish.py) ----------
export const stripFrontmatter = (md) => md.replace(FRONTMATTER, '').replace(/^\n+/, '')

const normalize = (text) => text.normalize('NFC').replace(TASHKEEL, '').split(/\s+/).filter(Boolean).join(' ')

async function sha1Hex(text) {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const cardGuid = async (courseId, question) => (await sha1Hex(`${courseId}\t${normalize(question)}`)).slice(0, 16)

/** anki.tsv : question \t réponse \t tags [\t guid] ; lignes `#` ignorées. */
export async function parseCards(text, courseId) {
  const cards = []
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim() || raw.startsWith('#')) continue
    const cols = raw.split('\t')
    if (cols.length < 2) continue
    const question = cols[0].trim()
    const answer = cols[1].trim()
    const tags = cols[2] ? cols[2].split(/\s+/).filter(Boolean) : []
    const guid = cols[3]?.trim() || (await cardGuid(courseId, question))
    cards.push({ guid, course_id: courseId, question, answer, tags, position: cards.length })
  }
  return cards
}

/** Titres portant un marqueur [mm:ss] ou [h:mm:ss] -> chapitres. */
export function parseChapters(md, courseId) {
  const chapters = []
  const seen = new Set()
  for (const line of md.split('\n')) {
    const m = TIMESTAMP_HEADING.exec(line)
    if (!m) continue
    const [a, b, c] = [Number(m[2]), Number(m[3]), m[4]]
    const seconds = c !== undefined ? a * 3600 + b * 60 + Number(c) : a * 60 + b
    if (seen.has(seconds)) continue
    seen.add(seconds)
    chapters.push({ course_id: courseId, seconds, title: m[1].trim() })
  }
  return chapters
}

/** mindmap.json : vérifie le schéma minimal {t, k?} récursif. */
export function parseMindmap(text) {
  const tree = JSON.parse(text)
  const check = (n, path) => {
    if (!n || typeof n.t !== 'string') throw new Error(`nœud sans titre « t » : ${path}`)
    ;(n.k ?? []).forEach((c, i) => check(c, `${path}/${i}`))
  }
  check(tree, 'racine')
  return tree
}

// ---------- horodatages des titres ----------
const HEADING = /^(#{1,6})\s+(.*?)\s*(?:\[(\d{1,2}):(\d{2})(?::(\d{2}))?\])?\s*$/

/** Titres du résumé avec leur temps (secondes ou null) : [{ line, level, title, seconds }]. */
export function summaryHeadings(md) {
  const out = []
  ;(md ?? '').split('\n').forEach((text, line) => {
    const m = HEADING.exec(text)
    if (!m) return
    const [a, b, c] = [m[3], m[4], m[5]]
    const seconds = a === undefined ? null : c !== undefined ? +a * 3600 + +b * 60 + +c : +a * 60 + +b
    out.push({ line, level: m[1].length, title: m[2], seconds })
  })
  return out
}

/** "12:34" ou "1:02:03" -> secondes ; "" -> null ; sinon NaN. */
export function parseTime(text) {
  const t = text.trim()
  if (!t) return null
  if (!/^\d{1,2}(:\d{2}){1,2}$/.test(t)) return NaN
  return t.split(':').reduce((acc, p) => acc * 60 + Number(p), 0)
}

export function formatTime(seconds) {
  if (seconds === null || seconds === undefined) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

/** Réécrit les marqueurs [m:ss] des titres ; times = { [line]: seconds | null }. */
export function applyHeadingTimes(md, times) {
  const lines = md.split('\n')
  for (const [line, seconds] of Object.entries(times)) {
    const m = HEADING.exec(lines[line] ?? '')
    if (!m) continue
    lines[line] = `${m[1]} ${m[2]}${seconds === null ? '' : ` [${formatTime(seconds)}]`}`
  }
  return lines.join('\n')
}

export const updateSummary = (id, summary_md) =>
  run(supabase.from('courses').update({ summary_md, updated_at: new Date().toISOString() }).eq('id', id))

// ---------- suggestions des élèves et relecteurs ----------
/** Vrai si l'utilisateur connecté est relecteur (ou admin). */
export async function isReviewer() {
  const { data, error } = await supabase.rpc('is_reviewer')
  if (error) throw new Error(error.message)
  return data === true
}

export const listSuggestions = (statuses) =>
  run(
    supabase
      .from('suggestions')
      .select('id, course_id, tab, location, kind, original, proposed, author, status, fix, note, created_at, reviewed_at, reviewed_by, courses(title)')
      .in('status', statuses)
      .order('created_at', { ascending: false }),
  )

export const updateSuggestion = (id, fields, email) =>
  run(supabase.from('suggestions').update({ ...fields, reviewed_at: new Date().toISOString(), reviewed_by: email ?? null }).eq('id', id))

export const deleteSuggestion = (id) => run(supabase.from('suggestions').delete().eq('id', id))

export const listReviewers = () => run(supabase.from('reviewers').select('email').order('email'))
export const addReviewer = (email) => run(supabase.from('reviewers').insert({ email: email.trim().toLowerCase() }))
export const removeReviewer = (email) => run(supabase.from('reviewers').delete().eq('email', email))

const HEADING_MARK = /\s*\[\d{1,2}:\d{2}(?::\d{2})?\]\s*$/
const normTitle = (t) => t.replace(HEADING_MARK, '').trim()

/**
 * Remplace le corps d'une section de niveau 2 (titre = `location`) par `fix`, en gardant la ligne de titre
 * (et son horodatage). Renvoie null si le titre n'est pas trouvé.
 */
export function replaceSection(md, location, fix) {
  const lines = md.split('\n')
  const start = lines.findIndex((l) => /^##\s+/.test(l) && normTitle(l.replace(/^##\s+/, '')) === normTitle(location))
  if (start < 0) return null
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) {
      end = i
      break
    }
  }
  const body = fix.replace(/\s+$/, '')
  return [...lines.slice(0, start + 1), '', body, '', ...lines.slice(end)].join('\n').replace(/\n{3,}/g, '\n\n')
}

/** Fichier anki-ok.tsv reconstruit depuis la base (question, réponse, tags, guid). */
export async function cardsAsTsv(courseId) {
  const cards = await run(supabase.from('cards').select('guid, question, answer, tags, position').eq('course_id', courseId).order('position'))
  const esc = (t) => String(t ?? '').replace(/\t/g, ' ').replace(/\r?\n/g, '<br>')
  return ['# question\tréponse\ttags\tguid', ...cards.map((c) => `${esc(c.question)}\t${esc(c.answer)}\t${(c.tags ?? []).join(' ')}\t${c.guid}`)].join('\n') + '\n'
}

/**
 * Applique une suggestion acceptée en base, passe le cours en `manual` (le CI ne l'écrase plus) et renvoie
 * le fichier corrigé à remettre dans le vault : { name, text }. Carte mentale : pas d'application automatique.
 */
export async function applySuggestion(s, fix, email) {
  if (s.tab === 'summary') {
    const course = await run(supabase.from('courses').select('id, summary_md').eq('id', s.course_id).single())
    const md = replaceSection(course.summary_md ?? '', s.location, fix)
    if (md === null) throw new Error(`لم يُعثر على القسم « ${s.location} » في الملخّص.`)
    await run(supabase.from('courses').update({ summary_md: md, managed_by: 'manual', updated_at: new Date().toISOString() }).eq('id', s.course_id))
    await updateSuggestion(s.id, { status: 'applied', fix }, email)
    return { name: 'resume-ok.md', text: md }
  }
  if (s.tab === 'review') {
    let parsed
    try {
      parsed = JSON.parse(fix)
    } catch {
      throw new Error('صيغة التصحيح غير صالحة.')
    }
    await run(supabase.from('cards').update({ question: parsed.question, answer: parsed.answer }).eq('guid', s.location))
    await run(supabase.from('courses').update({ managed_by: 'manual', updated_at: new Date().toISOString() }).eq('id', s.course_id))
    await updateSuggestion(s.id, { status: 'applied', fix }, email)
    return { name: 'anki-ok.tsv', text: await cardsAsTsv(s.course_id) }
  }
  await updateSuggestion(s.id, { status: 'applied', fix }, email)
  return null
}
