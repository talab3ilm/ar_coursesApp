// Utilitaires de texte arabe : normalisation pour la recherche, formats d'affichage.

const TASHKEEL = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g

/** Retire tashkeel et tatweel, unifie alif / ya / ta marbuta, compacte les espaces. */
export function normalize(text) {
  return (text ?? '')
    .normalize('NFC')
    .replace(TASHKEEL, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')
}

/** Vrai si tous les mots de la requête apparaissent dans le texte (normalisés). */
export function matches(text, query) {
  const t = normalize(text)
  return normalize(query).split(' ').every((w) => t.includes(w))
}

/** 3723 -> "1:02:03", 72 -> "1:12". */
export function formatSeconds(total) {
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = h ? String(m).padStart(2, '0') : String(m)
  return `${h ? h + ':' : ''}${mm}:${String(s).padStart(2, '0')}`
}

/** "1:02:03" ou "12:34" -> secondes. */
export function parseTimestamp(text) {
  const parts = text.split(':').map(Number)
  if (parts.some(Number.isNaN)) return null
  return parts.reduce((acc, p) => acc * 60 + p, 0)
}

/** Identifiant YouTube d'un cours, ou null pour un cours sans vidéo (plateforme). */
export function youtubeId(course) {
  if (!course?.youtube_url) return null
  const m = course.youtube_url.match(/(?:v=|youtu\.be\/)([\w-]{11})/)
  return m ? m[1] : null
}

/** Mélange de Fisher-Yates, copie. */
export function shuffle(list) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
