// Accès aux données publiées. Chaque fonction renvoie des objets simples, prêts pour l'affichage.
import { supabase } from './supabase'

const COURSE_FIELDS = 'id, subject_id, number, title, teacher, date, duration, youtube_url'

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
    run(supabase.from('chapters').select('seconds, title').eq('course_id', id).order('seconds')),
    run(supabase.from('mindmaps').select('tree').eq('course_id', id).maybeSingle()),
  ])
  return { ...course, subject_name: course.subjects?.name_ar ?? '', cards, chapters, mindmap: mindmap?.tree ?? null }
}
