// Réglages du site (table settings), appliqués au chargement et modifiables depuis /admin.
import { supabase } from './supabase'

/** Polices arabes proposées (Google Fonts). `google` = paramètre family de l'API CSS2. */
export const FONTS = [
  { name: 'Noto Naskh Arabic', google: 'Noto+Naskh+Arabic:wght@400;500;700', kind: 'naskh' },
  { name: 'Amiri', google: 'Amiri:ital,wght@0,400;0,700;1,400', kind: 'naskh' },
  { name: 'Scheherazade New', google: 'Scheherazade+New:wght@400;700', kind: 'naskh' },
  { name: 'Lateef', google: 'Lateef:wght@400;700', kind: 'naskh' },
  { name: 'Markazi Text', google: 'Markazi+Text:wght@400;700', kind: 'naskh' },
  { name: 'Harmattan', google: 'Harmattan:wght@400;700', kind: 'naskh' },
  { name: 'IBM Plex Sans Arabic', google: 'IBM+Plex+Sans+Arabic:wght@400;500;700', kind: 'sans' },
  { name: 'Noto Sans Arabic', google: 'Noto+Sans+Arabic:wght@400;500;700', kind: 'sans' },
  { name: 'Noto Kufi Arabic', google: 'Noto+Kufi+Arabic:wght@400;700', kind: 'sans' },
  { name: 'Cairo', google: 'Cairo:wght@400;600;700', kind: 'sans' },
  { name: 'Tajawal', google: 'Tajawal:wght@400;500;700', kind: 'sans' },
  { name: 'Almarai', google: 'Almarai:wght@400;700', kind: 'sans' },
  { name: 'Readex Pro', google: 'Readex+Pro:wght@400;500;700', kind: 'sans' },
  { name: 'El Messiri', google: 'El+Messiri:wght@400;700', kind: 'display' },
  { name: 'Reem Kufi', google: 'Reem+Kufi:wght@400;700', kind: 'display' },
]

export const DEFAULT_TYPOGRAPHY = {
  read: 'Noto Naskh Arabic', // paragraphes du résumé, cartes, carte mentale
  display: 'Amiri', // titres, versets, vers
  body: 'IBM Plex Sans Arabic', // interface
  readSize: 1.2, // rem
  readLineHeight: 2.15,
  wordSpacing: 0.12, // em
}

const CACHE_KEY = 'ar_coursesApp.typography'
const loaded = new Set()

function ensureFont(name) {
  const font = FONTS.find((f) => f.name === name)
  if (!font || loaded.has(name)) return
  loaded.add(name)
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${font.google}&display=swap`
  document.head.appendChild(link)
}

const stack = (name, kind) => `'${name}', ${kind === 'sans' ? "'Segoe UI', 'Tahoma', sans-serif" : "'Traditional Arabic', serif"}`

/** Applique la typographie au document (variables CSS) et charge les polices manquantes. */
export function applyTypography(t) {
  const typo = { ...DEFAULT_TYPOGRAPHY, ...t }
  const root = document.documentElement.style
  for (const key of ['read', 'display', 'body']) {
    ensureFont(typo[key])
    const kind = FONTS.find((f) => f.name === typo[key])?.kind ?? 'naskh'
    root.setProperty(`--f-${key === 'read' ? 'read' : key}`, stack(typo[key], kind))
  }
  root.setProperty('--read-size', `${typo.readSize}rem`)
  root.setProperty('--read-lh', String(typo.readLineHeight))
  root.setProperty('--read-ws', `${typo.wordSpacing}em`)
  return typo
}

/** Au démarrage : cache local d'abord (pas de saut), puis valeur de la base. */
export async function loadTypography() {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) applyTypography(JSON.parse(cached))
  } catch {
    /* pas de cache */
  }
  const { data } = await supabase.from('settings').select('value').eq('key', 'typography').maybeSingle()
  const typo = applyTypography(data?.value ?? {})
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(typo))
  } catch {
    /* stockage indisponible */
  }
  return typo
}

export async function saveTypography(typo) {
  const { error } = await supabase.from('settings').upsert({ key: 'typography', value: typo, updated_at: new Date().toISOString() })
  if (error) throw new Error(error.message)
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(typo))
  } catch {
    /* stockage indisponible */
  }
}
