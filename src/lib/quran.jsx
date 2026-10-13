// Mise en forme automatique des citations : tout passage entre ﴿ et ﴾ (Coran) ou entre { et }
// (hadith, nass) est rendu dans la police d'apparat (Amiri), comme les vers. Rien à changer
// dans les fichiers du vault. Les crochets ornés sont acceptés dans les deux sens (saisie RTL).
const QURAN = /([﴿﴾][^﴿﴾]*[﴿﴾]|\{[^{}]*\})/g

/** Texte brut -> tableau de fragments React (chaînes et <span class="quran">). */
export function withQuran(text) {
  if (!text || !text.includes('﴿')) return text
  return text.split(QURAN).map((part, i) =>
    /^[﴿﴾{]/.test(part) ? (
      <span key={i} className="quran" lang="ar">
        {part}
      </span>
    ) : (
      part
    ),
  )
}

/** Plugin remark : même traitement dans le Markdown du résumé (nœuds texte uniquement). */
export function remarkQuran() {
  const walk = (node) => {
    if (!node.children) return
    const out = []
    for (const child of node.children) {
      if (child.type === 'text' && child.value.includes('﴿')) {
        for (const part of child.value.split(QURAN)) {
          if (!part) continue
          out.push(
            /^[﴿﴾{]/.test(part)
              ? { type: 'emphasis', data: { hName: 'span', hProperties: { className: ['quran'], lang: 'ar' } }, children: [{ type: 'text', value: part }] }
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
