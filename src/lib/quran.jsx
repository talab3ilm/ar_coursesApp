// Mise en forme automatique des citations, convention du 2026-10-13 :
//   {{…}}  Coran   -> affiché ﴿…﴾ en police d'apparat (Amiri)
//   {…}    hadith  -> affiché «…» en police d'apparat
//   ﴿…﴾    Coran déjà encadré (crochets acceptés dans les deux sens, saisie RTL) -> inchangé
// Rien à changer dans les fichiers du vault au-delà de cette convention.
const CITATION = /(\{\{[^{}]*\}\}|\{[^{}]*\}|[﴿﴾][^﴿﴾]*[﴿﴾])/g

/** Classe et texte affiché d'un fragment reconnu, ou null. */
function classify(part) {
  if (part.startsWith('{{')) return { className: 'quran', text: `﴿${part.slice(2, -2).trim()}﴾` }
  if (part.startsWith('{')) return { className: 'hadith', text: `«${part.slice(1, -1).trim()}»` }
  if (/^[﴿﴾]/.test(part)) return { className: 'quran', text: `﴿${part.slice(1, -1).trim()}﴾` }
  return null
}

/** Texte brut -> tableau de fragments React (chaînes et <span>). */
export function withQuran(text) {
  if (!text || !/[﴿﴾{]/.test(text)) return text
  return text.split(CITATION).map((part, i) => {
    const c = classify(part)
    return c ? (
      <span key={i} className={c.className} lang="ar">
        {c.text}
      </span>
    ) : (
      part
    )
  })
}

/** Plugin remark : même traitement dans le Markdown du résumé (nœuds texte uniquement). */
export function remarkQuran() {
  const walk = (node) => {
    if (!node.children) return
    const out = []
    for (const child of node.children) {
      if (child.type === 'text' && /[﴿﴾{]/.test(child.value)) {
        for (const part of child.value.split(CITATION)) {
          if (!part) continue
          const c = classify(part)
          out.push(
            c
              ? { type: 'emphasis', data: { hName: 'span', hProperties: { className: [c.className], lang: 'ar' } }, children: [{ type: 'text', value: c.text }] }
              : { type: 'text', value: part },
          )
        }
      } else {
        walk(child)
        out.push(child)
      }
    }
    node.children = out
  }
  return walk
}
