// Progression locale (localStorage), par carte, identifiée par son guid stable.
// Boîtes de Leitner 1..5 ; une carte « sue » monte d'une boîte, une carte ratée revient en 1.
// L'export / import JSON et le bandeau d'avertissement arrivent à l'étape 4.

const KEY = 'ar_coursesApp.progress.v1'
const INTERVAL_DAYS = [0, 1, 3, 7, 14, 30] // index = boîte ; boîte 0 = jamais vue
export const MAX_BOX = 5
const DAY = 86_400_000

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    const data = raw ? JSON.parse(raw) : null
    if (data && data.version === 1 && data.cards) return data
  } catch {
    /* stockage indisponible ou corrompu : on repart de zéro */
  }
  return { version: 1, cards: {}, lastCourse: null }
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
