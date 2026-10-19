// Suggestions des élèves : envoi anonyme dans la table suggestions (insertion seule).
import { supabase } from './supabase'

export const KINDS = [
  ['error', 'خطأ في المحتوى'],
  ['add', 'إضافة ناقصة'],
  ['reword', 'إعادة صياغة'],
  ['remove', 'حذف'],
  ['other', 'ملاحظة أخرى'],
]
export const TABS = { summary: 'الملخص', review: 'بطاقة مراجعة', map: 'الخريطة الذهنية' }

const AUTHOR_KEY = 'ar_coursesApp.author'
const LAST_KEY = 'ar_coursesApp.lastSuggestion'
const MIN_GAP_MS = 20_000

export function rememberedAuthor() {
  try {
    return localStorage.getItem(AUTHOR_KEY) ?? ''
  } catch {
    return ''
  }
}

/** Envoie une suggestion. `website` est un champ piège : rempli par un robot, on fait semblant d'envoyer. */
export async function sendSuggestion({ courseId, tab, location, kind, original, proposed, author, website }) {
  const text = proposed.trim()
  if (text.length < 3) throw new Error('اكتب اقتراحك أولا.')
  if (text.length > 6000) throw new Error('الاقتراح طويل جدا (الحد 6000 حرف).')
  let last = 0
  try {
    last = Number(localStorage.getItem(LAST_KEY) ?? 0)
  } catch {
    /* ignore */
  }
  if (Date.now() - last < MIN_GAP_MS) throw new Error('انتظر قليلا قبل إرسال اقتراح آخر.')
  if (website) return // piège à robots
  const row = {
    course_id: courseId,
    tab,
    location: (location ?? '').slice(0, 500),
    kind,
    original: (original ?? '').slice(0, 20000),
    proposed: text,
    author: (author ?? '').trim().slice(0, 80),
  }
  const { error } = await supabase.from('suggestions').insert(row)
  if (error) throw new Error('تعذّر الإرسال، أعد المحاولة لاحقا.')
  try {
    localStorage.setItem(LAST_KEY, String(Date.now()))
    localStorage.setItem(AUTHOR_KEY, row.author)
  } catch {
    /* ignore */
  }
}
