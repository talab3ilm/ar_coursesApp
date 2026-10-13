// Mise en forme automatique des citations coraniques : tout passage entre ﴿ et ﴾ est rendu
// dans la police d'apparat (Amiri), comme les vers. Rien à changer dans les fichiers du vault.
const QURAN = /(﴿[^﴾]*﴾)/g

/** Texte brut -> tableau de fragments React (chaînes et <span class="quran">). */
export function withQuran(text) {
  if (!text || !text.includes('﴿')) return text
  return text.split(QURAN).map((part, i) =>
    part.startsWith('﴿') ? (
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
            part.startsWith('﴿')
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
