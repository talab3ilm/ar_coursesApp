import { useSyncExternalStore } from 'react'

/** Vrai quand la requête média est satisfaite ; se met à jour à la rotation ou au redimensionnement. */
export function useMediaQuery(query) {
  const subscribe = (cb) => {
    const mql = window.matchMedia(query)
    mql.addEventListener('change', cb)
    return () => mql.removeEventListener('change', cb)
  }
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false)
}
