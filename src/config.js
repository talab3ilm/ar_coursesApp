// Interrupteurs d'affichage. Les données restent publiées dans Supabase ; seuls ces drapeaux
// décident de ce que le site montre.
// 2026-10-14 : vidéos retirées. Le règlement de l'académie (albajiacademy.com/rules, art. 36-11,
// 36-13 et 41-2) interdit la publication des enregistrements hors de la plateforme sans
// autorisation, et les vidéos YouTube sont non répertoriées. Ne remettre à true qu'avec l'accord
// écrit de l'académie ; `supabase/hide_video.sql` masque aussi l'URL et les chapitres à `anon`.
export const SHOW_VIDEO_TAB = false // onglet « الفيديو » avec lecteur permanent
export const SHOW_TIMESTAMPS = false // horodatages cliquables (titres du résumé, sommaire, lecteur à la demande)
export const WANT_VIDEO = SHOW_VIDEO_TAB || SHOW_TIMESTAMPS // le front lit-il l'URL et les chapitres ?
