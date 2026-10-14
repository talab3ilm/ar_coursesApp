// Progression locale (localStorage), par carte, identifiée par son guid stable.
// Boîtes de Leitner 1..5 ; une carte « sue » monte d'une boîte, une carte ratée revient en 1.
// Export / import JSON : le fichier est la seule sauvegarde durable (pas de compte).

const KEY = 'ar_coursesApp.progress.v1'
const INTERVAL_DAYS = [0, 1, 3, 7, 14, 30] // index = boîte ; boîte 0 = jamais vue
export const MAX_BOX = 5
const DAY = 86_400_000

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    const data = raw ? JSON.parse(raw) : null
    if (data && data.version === 1 && data.cards) return { known: {}, ...data }
  } catch {
    /* stockage indisponible ou corrompu : on repart de zéro */
  }
  return { version: 1, cards: {}, known: {}, lastCourse: null, lastExport: null, answersSinceExport: 0 }
}

function save(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    /* quota ou navigation privée : la session continue sans persistance */
  }
}

let state = load()
const listeners = new Set()

function commit() {
  save(state)
  listeners.forEach((fn) => fn(state))
}

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getSnapshot() {
  return state
}

export function cardState(guid) {
  return state.cards[guid] ?? { box: 0, due: 0, seen: 0 }
}

/** Enregistre une réponse. known = true si l'étudiant connaissait la carte. */
export function answer(guid, known) {
  const prev = cardState(guid)
  const box = known ? Math.min(prev.box + 1, MAX_BOX) : 1
  state = {
    ...state,
    cards: { ...state.cards, [guid]: { box, due: Date.now() + INTERVAL_DAYS[box] * DAY, seen: prev.seen + 1 } },
    answersSinceExport: (state.answersSinceExport ?? 0) + 1,
  }
  commit()
}

export function isDue(guid, now = Date.now()) {
  return cardState(guid).due <= now
}

export function rememberCourse(id) {
  if (state.lastCourse === id) return
  state = { ...state, lastCourse: id }
  commit()
}

export function resetCourse(guids) {
  const cards = { ...state.cards }
  guids.forEach((g) => delete cards[g])
  state = { ...state, cards }
  commit()
}

/** Répartition par boîte pour un jeu de cartes : [n boîte 0, n boîte 1, …]. */
export function boxCounts(guids) {
  const counts = Array(MAX_BOX + 1).fill(0)
  guids.forEach((g) => counts[cardState(g).box]++)
  return counts
}

/** Nombre de cartes suivies (vues au moins une fois). */
export function trackedCount() {
  return Object.keys(state.cards).length
}

const REMIND_AFTER = 30 // réponses depuis le dernier export avant de rappeler
const REMIND_FIRST = 20 // cartes suivies sans aucun export

export function needsExportReminder() {
  const since = state.answersSinceExport ?? 0
  return since >= REMIND_AFTER || (!state.lastExport && trackedCount() >= REMIND_FIRST)
}

/** Contenu du fichier d'export (JSON lisible). */
export function exportJson() {
  return JSON.stringify(
    { app: 'ar_coursesApp', version: 1, exportedAt: new Date().toISOString(), cards: state.cards, known: state.known ?? {}, lastCourse: state.lastCourse },
    null,
    2,
  )
}

export function markExported() {
  state = { ...state, lastExport: Date.now(), answersSinceExport: 0 }
  commit()
}

/** Valide un fichier d'export ; renvoie { cards, exportedAt, count } ou lève une erreur (message en arabe). */
export function parseImport(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('الملف ليس ملف JSON صالحا.')
  }
  if (!data || data.app !== 'ar_coursesApp' || data.version !== 1 || typeof data.cards !== 'object') {
    throw new Error('هذا الملف ليس ملف تقدّم من هذا الموقع.')
  }
  const cards = {}
  for (const [guid, c] of Object.entries(data.cards)) {
    if (!c || typeof c.box !== 'number' || typeof c.due !== 'number') continue
    cards[guid] = { box: Math.min(Math.max(Math.round(c.box), 0), MAX_BOX), due: c.due, seen: Number(c.seen) || 0 }
  }
  const known = Object.fromEntries(Object.entries(data.known ?? {}).filter(([, v]) => v === true))
  return { cards, known, exportedAt: data.exportedAt ?? null, count: Object.keys(cards).length }
}

/** Applique un import : 'replace' écrase tout, 'merge' garde pour chaque carte la boîte la plus haute. */
export function importCards(cards, mode, known = {}) {
  let merged = cards
  let mergedKnown = known
  if (mode === 'merge') {
    mergedKnown = { ...(state.known ?? {}), ...known }
    merged = { ...state.cards }
    for (const [guid, c] of Object.entries(cards)) {
      const cur = merged[guid]
      if (!cur || c.box > cur.box || (c.box === cur.box && c.due > cur.due)) merged[guid] = c
    }
  }
  state = { ...state, cards: merged, known: mergedKnown, lastExport: Date.now(), answersSinceExport: 0 }
  commit()
}

/** Questions de la carte mentale marquées « عرفتُها » (clé = cours + chemin du nœud + question). */
export function isKnown(key) {
  return state.known?.[key] === true
}

export function toggleKnown(key) {
  const known = { ...(state.known ?? {}) }
  if (known[key]) delete known[key]
  else known[key] = true
  state = { ...state, known, answersSinceExport: (state.answersSinceExport ?? 0) + 1 }
  commit()
}
