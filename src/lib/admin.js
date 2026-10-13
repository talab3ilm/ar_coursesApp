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

export const saveMindmap = (courseId, tree) => run(supabase.from('mindmaps').upsert({ course_id: courseId, tree }))

export async function uploadFile(subjectId, courseId, name, text, mime) {
  const { error } = await supabase.storage
    .from('content')
    .upload(`${subjectId}/${courseId}/${name}`, new Blob([text], { type: mime }), { upsert: true, contentType: mime })
  if (error) throw new Error(error.message)
}

export async function deleteCourse(id) {
  await run(supabase.from('courses').delete().eq('id', id)) // cartes, chapitres, carte : cascade
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
