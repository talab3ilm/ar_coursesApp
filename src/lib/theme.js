// Thème clair / sombre : choix de l'élève dans localStorage, sinon réglage du système.
import { useSyncExternalStore } from 'react'

export const THEME_KEY = 'ar_coursesApp.theme' // 'light' | 'dark' ; absent = système
const listeners = new Set()

export function savedTheme() {
  try {
    const v = localStorage.getItem(THEME_KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

/** Thème effectivement affiché. */
export function resolvedTheme() {
  return savedTheme() ?? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
}

export function applyTheme() {
  const saved = savedTheme()
  if (saved) document.documentElement.dataset.theme = saved
  else delete document.documentElement.dataset.theme
  listeners.forEach((l) => l())
}

export function setTheme(theme) {
  try {
    if (theme) localStorage.setItem(THEME_KEY, theme)
    else localStorage.removeItem(THEME_KEY)
  } catch {
    /* stockage indisponible : le thème ne tient que pour la page */
    document.documentElement.dataset.theme = theme ?? ''
  }
  applyTheme()
}

function subscribe(cb) {
  listeners.add(cb)
  const mql = window.matchMedia?.('(prefers-color-scheme: dark)')
  mql?.addEventListener('change', cb)
  return () => {
    listeners.delete(cb)
    mql?.removeEventListener('change', cb)
  }
}

export const useTheme = () => useSyncExternalStore(subscribe, resolvedTheme, () => 'light')
