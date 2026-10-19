// Accès aux données publiées. Chaque fonction renvoie des objets simples, prêts pour l'affichage.
import { supabase } from './supabase'
import { WANT_VIDEO } from '../config'

// Sans vidéo, l'URL YouTube et les chapitres ne sont ni lus ni accessibles à anon (hide_video.sql).
const COURSE_FIELDS = 'id, subject_id, number, title, teacher, date, duration' + (WANT_VIDEO ? ', youtube_url' : '')

async function run(query) {
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data
}

/** Matières ordonnées, chacune avec la liste de ses cours publiés. */
export async function fetchCatalog() {
  const [subjects, courses] = await Promise.all([
    run(supabase.from('subjects').select('id, name_ar, position').order('position')),
    run(supabase.from('courses').select(COURSE_FIELDS).order('number', { nullsFirst: false }).order('date')),
  ])
  return subjects.map((s) => ({ ...s, courses: courses.filter((c) => c.subject_id === s.id) }))
}

/** Un cours complet : résumé, cartes, chapitres, carte mentale (null si absente). */
export async function fetchCourse(id) {
  const course = await run(
    supabase.from('courses').select(`${COURSE_FIELDS}, summary_md, subjects(name_ar)`).eq('id', id).maybeSingle(),
  )
  if (!course) return null
  const [cards, chapters, mindmap] = await Promise.all([
    run(supabase.from('cards').select('guid, question, answer, tags, position').eq('course_id', id).order('position')),
    WANT_VIDEO ? run(supabase.from('chapters').select('seconds, title').eq('course_id', id).order('seconds')) : Promise.resolve([]),
    run(supabase.from('mindmaps').select('tree').eq('course_id', id).maybeSingle()),
  ])
  return { ...course, subject_name: course.subjects?.name_ar ?? '', cards, chapters, mindmap: mindmap?.tree ?? null }
}

/** Nombre de suggestions d'élèves appliquées à un cours (0 si la table n'existe pas encore). */
export async function appliedSuggestions(courseId) {
  const { data, error } = await supabase.rpc('applied_suggestions', { p_course_id: courseId })
  return error ? 0 : data ?? 0
}

/** Noms des contributeurs dont une suggestion a été appliquée. */
export async function contributors() {
  const { data, error } = await supabase.rpc('contributors')
  return error ? [] : data ?? []
}

