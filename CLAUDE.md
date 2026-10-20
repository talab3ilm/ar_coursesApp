# CLAUDE.md — ar_coursesApp (vitrine en ligne des cours du second cerveau)

Troisième dépôt du projet : `https://github.com/talab3ilm/ar_coursesApp` (créé le
2026-10-13, vide). Il publie pour les
étudiants de l'académie le contenu produit par le pipeline : vidéos, résumés cliquables,
quiz tirés des cartes Anki, cartes mentales. Rien n'est encore codé ; ce fichier fixe les
décisions prises le 2026-10-13 et sert de constitution au dépôt.

## Les trois dépôts

| Dépôt | Rôle | Visibilité |
|---|---|---|
| `ar_audioToMd` | pipeline : YouTube, PDF, plateforme → Markdown, résumés, cartes Anki | privé |
| `secondBrain` | vault Obsidian, source de vérité du contenu (`raw/`, `wiki/`) | privé |
| `ar_coursesApp` (ici) | application web + alimentation automatique depuis le vault | public possible |

Le vault garde sa structure actuelle, on n'y touche pas pour l'appli. Git ne sait pas pousser
une partie d'un dépôt vers un autre dépôt : c'est une action CI de ce dépôt qui lit le vault
et en extrait les fichiers utiles (voir « Alimentation »). Le contenu vit dans Supabase, pas
dans ce dépôt, ce qui permet de le rendre public sans exposer transcriptions et livres.

## Origine et crédit

L'interface repart de `miniApp.html`, première version du projet générée avec Claude par
Abdelali, étudiant de l'académie, qui a donné son accord le 2026-10-13 pour qu'on la
reprenne et l'enrichisse. Le fichier original est conservé tel quel, hors git, dans
`docs/miniApp.html` et Abdelali crédité dans le README et dans la page « à propos » de
l'appli.

Ce qu'on reprend de miniApp : la mise en page RTL (Amiri, IBM Plex Sans Arabic), l'arbre
dépliable, la vue révision avec « عرفتُها », la recherche, le schéma de nœud de la carte
mentale. Ce qu'on corrige : identifiants de progression instables (indexés par ordre de
parcours), recherche sensible au tashkeel et aveugle aux questions, cours sélectionné non
mémorisé, données mélangées au code.

## Stack retenue

- **Front** : React + Vite, interface en arabe, `dir="rtl"`. Hébergé sur **Vercel**
  (déploiement automatique à chaque push sur `main`).
- **Données** : **Supabase** (Postgres + Storage + Auth), projet `coursesApp`, région
  Europe, organisation `talab3ilm`, lié au dépôt GitHub : les migrations SQL commitées dans
  `supabase/migrations/` sont appliquées à chaque push. Le projet a été créé avec RLS
  automatique activé et sans exposition automatique des tables : chaque table est exposée
  explicitement dans sa migration (`grant select` à `anon`, politiques RLS). Le front lit
  avec la clé `anon` et des règles RLS en lecture seule sur les lignes publiées. Pas de
  backend maison : le tableau de bord admin écrit directement dans Supabase, authentifié.
- **Alimentation** : GitHub Actions dans ce dépôt + script Python `tools/publish.py`
  (clé `service_role`, secret GitHub uniquement, jamais dans le front).
- **Étudiants** : pas de compte. Progression en `localStorage`, exportable et importable
  dans un fichier JSON, avec avertissement visible sur la perte en cas de vidage du cache.
- Repli envisagé si Supabase pose problème : Render + FastAPI.

Risques connus des offres gratuites : un projet Supabase inactif sept jours est mis en
pause (prévoir un ping quotidien dans l'action CI) ; quotas Storage et bande passante à
surveiller si on héberge les `.apkg`.

## Modèle de données (Supabase)

- `subjects` : `id` (slug latin : `sira`, `fiqh`, `tajwid`, `aqida`, `nahw`, `sarf`),
  `name_ar`, `position`.
- `courses` : `id` (identifiant YouTube ou identifiant plateforme), `subject_id`, `number`,
  `title`, `teacher`, `date`, `duration`, `youtube_url`, `summary_md`, `published`,
  `managed_by` (`pipeline` ou `manual`), `updated_at`.
- `cards` : `guid`, `course_id`, `question`, `answer`, `tags[]`, `position`.
- `mindmaps` : `course_id`, `tree` (jsonb, schéma ci-dessous).
- `chapters` : `course_id`, `seconds`, `title` (horodatages pour la vidéo).
- Bucket Storage `content/<subject>/<course_id>/` : `resume.md`, `anki.tsv`, `anki.apkg`,
  `mindmap.json`. Les fichiers y sont renommés ainsi quel que soit leur nom dans le vault :
  `publish.py` accepte `anki*.tsv`, `anki*.apkg`, `resume-ok.md` ou `resume.md` (le premier
  trouvé) et `mindmap-ok.json` uniquement (jamais `mindmap.json`, brouillon non relu) ; il ne
  modifie jamais le vault lui-même.

Règle de cohabitation CI / admin : l'action CI ne touche jamais une ligne `managed_by =
manual` ; le tableau de bord peut basculer une ligne en `manual` pour figer une correction.

## Alimentation depuis le vault

Action `publish.yml` de ce dépôt, déclenchée par `repository_dispatch` envoyé par une action
minimale du vault à chaque push sur `main`, plus un déclenchement manuel et un cron quotidien
(qui sert aussi de ping Supabase). Elle clone le vault avec un jeton en lecture seule, puis
`tools/publish.py` :

1. parcourt `raw/youtube/` et `raw/academy/` ; un cours est publiable s'il contient
   `meta.md`, `resume-ok.md` (résumé relu, même convention que `texte-ok.md`) et `anki.tsv` ;
2. lit `meta.md` (`id`, `url`, `title`, `speaker`, `series`, `date`, `duration`) ; la
   matière vient de `series`, le numéro du nom du dossier plateforme ou de l'ordre des dates ;
3. renomme et téléverse les fichiers dans Storage, upserte `courses`, `cards`, `mindmaps`,
   `chapters` ; idempotent, clé = `id` du cours ;
4. publie (`published = true`) ; un cours retiré du vault n'est pas supprimé, il est
   dépublié.

Les `guid` des cartes doivent venir du pipeline (colonne à ajouter dans `make_cards.py`) ;
à défaut, hachage de la question. Sans identifiant stable, la progression des étudiants se
décale à chaque modification de deck.

## Carte mentale : JSON, pas Mermaid

Format canonique : arbre JSON hérité de miniApp, un nœud =
`{"t": titre, "n": numéro?, "d": [[tag, texte, source]], "q": [[question, réponse]], "k": [enfants]}`
avec `tag` dans `def | key | ex | diff | link | warn | nass` et `source` = page, `"خ"` ou `"+"`.

Pourquoi pas Mermaid : la syntaxe mindmap de Mermaid ne porte que des libellés, sans
définitions, questions ni sources, et son analyse est fragile. Le JSON alimente directement
l'arbre interactif et la recherche. Le pipeline produit `mindmap.json` (brouillon, non relu) ;
l'utilisateur le relit et l'enregistre en `mindmap-ok.json`, **seul fichier que `publish.py`
lit** (règle du 2026-10-14, même logique que `resume-ok.md`). Il est produit à partir de
`resume-ok.md` (nouveau mode de `draft_lesson.py` dans `ar_audioToMd`) et pourra en dériver
un bloc Mermaid pour l'affichage dans Obsidian ; le JSON reste la source.

## Résumé cliquable et horodatages

Convention dans le Markdown du résumé : un marqueur `[mm:ss]` ou `[h:mm:ss]` en fin de titre
ou de paragraphe. Il est produit par un script d'alignement du pipeline qui rapproche chaque
section du résumé des segments horodatés de `transcript.md` (similarité textuelle, pas de
confiance aveugle au modèle). Dans l'appli, le marqueur devient un bouton qui fait sauter le
lecteur YouTube intégré (API IFrame, `seekTo`) ; lien de secours `youtu.be/<id>?t=<s>`. Les
mêmes marqueurs remplissent `chapters`. Dans Obsidian, le marqueur reste lisible.

## Écrans prévus

- Accueil : matières en onglets, cours en puces, état « قريبا » pour les matières vides.
- Page de cours, quatre onglets : الفيديو (lecteur + chapitres), الملخص (Markdown rendu,
  horodatages cliquables), المراجعة (cartes à retourner, QCM avec distracteurs tirés du même
  tag, boîtes de Leitner, progression par cours), الخريطة (arbre dépliable + recherche
  insensible au tashkeel, couvrant titres, contenus et questions).
- Progression : bandeau d'avertissement, boutons « تصدير » / « استيراد » (fichier JSON),
  rappel d'export quand la progression grossit.
- `/admin` : connexion Supabase Auth (liste blanche d'e-mails), formulaire par cours
  (matière, numéro, titre, enseignant, date, URL YouTube), dépôt de `resume.md`, `anki.tsv`,
  `mindmap.json`, aperçu, bascule publier / dépublier, bascule `manual`.

## Ordre de réalisation

1. Squelette Vite + React, copie de `docs/miniApp.html`, README avec crédit. Déploiement
   Vercel d'une page vide.
2. Projet Supabase, schéma, RLS, bucket ; `tools/publish.py` lancé à la main sur le vault.
3. Front de consultation (accueil, page de cours, révision, carte) branché sur Supabase.
4. Progression locale avec export / import.
5. Action CI `publish.yml` + action de dispatch dans le vault.
6. Tableau de bord `/admin`.
7. Côté pipeline (`ar_audioToMd`) : `guid` dans les cartes, mode mindmap, script d'alignement
   des horodatages.

## Conventions du dépôt

- Identité git `talab3ilm` (voir la mémoire « Identité git talab3ilm »). Commits en
  français, sujet « zone : ce qui change » (`front`, `admin`, `publish`, `ci`, `docs`).
- Interface en arabe ; chiffres latins partout ; code et identifiants en anglais ; commentaires
  et documentation en français.
- Citations dans le contenu : `{{…}}` est un verset coranique, `{…}` toute autre citation
  (hadith, savant, vers). Le rendu du résumé, des cartes et des nœuds de la carte mentale
  les met en valeur (style distinct pour chacun) et ne les affiche jamais avec les accolades.
- Secrets : `.env.local` (front, clés `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) hors
  git ; `SUPABASE_SERVICE_ROLE_KEY` et `VAULT_READ_TOKEN` uniquement dans les secrets GitHub.
  `VAULT_READ_TOKEN` est un jeton GitHub à portée fine du compte talab3ilm, limité au dépôt
  privé du vault, permission Contents en lecture seule. Dans l'autre sens, le vault garde un
  jeton limité à ce dépôt (Contents en écriture) pour envoyer le `repository_dispatch`.
  Les dépôts du pipeline et du vault sont privés ; l'appli n'a besoin que de lire le vault.
- Journaux CI : si ce dépôt est public, les journaux des actions le sont aussi. `publish.py`
  n'affiche jamais le contenu des résumés ni des cartes, seulement des noms et des comptages.
- Python des outils : `python3 -I` pour tout script qui lit des fichiers venant du vault.
- Aucun contenu de cours (résumés, transcriptions, PDF) n'est commité ici, sauf un jeu
  d'essai minimal dans `fixtures/` pour les tests.

## Règles de session et de contexte

Mêmes règles que `ar_audioToMd/CLAUDE.md` : une session par tâche, passation en mémoire à
chaque fin de tâche notable, jamais de gros fichier entier dans le contexte (`miniApp.html`
fait 48 k caractères : lecture par tranches ou par sous-agent), sorties Bash courtes,
traitements longs délégués à des sous-agents en arrière-plan.

## État au 2026-10-13 (étapes 2 et 3)

- `supabase/schema.sql` : schéma complet, RLS lecture publique sur les lignes publiées,
  bucket `content` public en lecture. À exécuter dans l'éditeur SQL de Supabase.
- `tools/publish.py` : lecture du vault, `--dry-run` sans réseau, `--only <id>`, `--ping`.
  Secrets lus dans l'environnement ou `.env.local` (`SUPABASE_SERVICE_ROLE_KEY`).
  Les `.apkg` ne sont pas téléversés pour l'instant (quota Storage).
- `fixtures/vault/` : un cours fictif (`fixture01`, matière tajwid) pour tester le script :
  `python3 -I tools/publish.py --vault fixtures/vault --dry-run`.
- Cours de la plateforme : `id = academy-<task_id>`, numéro = `lesson`, titre construit.
- Cours YouTube : `teacher` ignoré quand `speaker` recopie le titre (défaut du pipeline).
- Site déployé : <https://coursesapp-lac.vercel.app/>.
- Étape 3 faite : front React branché sur Supabase. Routes `/`, `/c/:id?tab=video|summary|
  review|map`, `/about` (`vercel.json` réécrit tout vers `index.html`). Modules :
  `src/lib/api.js` (lectures), `arabic.js` (normalisation tashkeel, horodatages),
  `progress.js` (Leitner 5 boîtes en localStorage, clé `ar_coursesApp.progress.v1`),
  `youtube.js` (API IFrame). Le lecteur reste monté quand on change d'onglet, pour que
  les horodatages du résumé fassent `seekTo` sans recharger.
- Révision : file des cartes dues, modes « بطاقات » et « اختيار من متعدد » (distracteurs
  pris dans le même tag, hors tag de matière), barre de répartition par boîte.
- Carte mentale : identifiant de nœud = chemin des titres ; recherche normalisée qui couvre
  titres, contenus et questions, avec compteur et « لا نتائج ».
- Le frontmatter YAML des résumés est retiré par `publish.py` (et par le front par sécurité).
- Captures de contrôle faites avec Playwright (Chromium en cache `~/.cache/ms-playwright`,
  `playwright-core` installé dans le scratchpad, pas dans le dépôt).
- Date affichée d'un cours YouTube = date de mise à disposition sur la plateforme, prise dans
  `raw/academy/<matière>/<date> الدرس N - …/meta.md` (même matière, même numéro) ; repli
  sur la date de la vidéo. Demande de l'utilisateur du 2026-10-13.
- 2026-10-13, demande de l'utilisateur : **pas d'onglet vidéo pour l'instant**
  (`SHOW_VIDEO_TAB = false` dans `src/pages/Course.jsx`). La vidéo s'ouvre à la demande dans
  un panneau collant (`PlayerPanel.jsx`) quand on clique un horodatage du résumé ou du sommaire.
- `tools/align.py` : horodatage automatique des titres du résumé par alignement sur
  `transcript.md` (mots rares, programmation dynamique monotone). Approximatif sur les
  sous-sections courtes ; un marqueur écrit à la main dans `resume-ok.md` est conservé tel
  quel. Contrôle : `python3 -I tools/align.py <resume-ok.md> <transcript.md>`.
- Chapitres et vidéo (2026-10-13) : la table `chapters` reçoit les **chapitres YouTube** de la
  vidéo source (`yt-dlp`, chemin via `--yt-dlp` ou `$YTDLP`, cache en base, `--refresh-chapters`
  pour recharger). Les titres du résumé prennent le temps du chapitre de titre semblable,
  sinon l'alignement sur la transcription borné par les chapitres voisins.
  `tools/overrides.json` permet, par cours, d'afficher une autre vidéo (`youtube_url`) tout
  en gardant les chapitres d'origine (`chapters_from`) : cas de la sira, nouvelle vidéo
  `x_8xVueL8FQ` sans chapitres, horodatages de `Y2iDJNpa7wg`. En CI, installer `yt-dlp`.
- `src/config.js` : `SHOW_VIDEO_TAB` et `SHOW_TIMESTAMPS`, tous deux à `false` le 2026-10-13
  à la demande de l'utilisateur. Les horodatages restent calculés et publiés ; le front
  retire les marqueurs à l'affichage. Les retours à la ligne simples du résumé deviennent
  des `<br>` (remark-breaks) pour les vers écrits un hémistiche par ligne.
- Étape 4 faite (2026-10-13) : page `/progress` (export JSON téléchargé, import avec
  « دمج » = boîte la plus haute par carte, ou « استبدال »), bandeau d'avertissement, rappel
  dans l'onglet révision après 30 réponses sans export ou 20 cartes jamais exportées.
  Format du fichier : `{app:"ar_coursesApp", version:1, exportedAt, cards:{guid:{box,due,seen}}}`.
- Convention de citation dans les résumés et cartes (décidée avec l'utilisateur le 2026-10-13) :
  `{{…}}` = Coran, affiché ﴿…﴾ ; `{…}` = hadith, affiché «…» ; ﴿…﴾ écrit directement = Coran.
  Tout en Amiri (`src/lib/quran.jsx` : plugin remark pour le résumé, `withQuran()` pour les
  cartes et la carte mentale).
- Étape 5 (2026-10-13) : `.github/workflows/publish.yml` (repository_dispatch `vault-updated`,
  lancement manuel avec `only` / `refresh_chapters`, cron quotidien 04:17 UTC qui sert de
  ping Supabase). Clone le vault `talab3ilm/secondbrain-albaji` avec `VAULT_READ_TOKEN`,
  installe `yt-dlp`, dry-run puis publication. Secrets GitHub du dépôt :
  `SUPABASE_SERVICE_ROLE_KEY`, `VAULT_READ_TOKEN`. Côté vault :
  `.github/workflows/notify-courses-app.yml` envoie le signal à chaque push touchant
  `raw/youtube/**` ou `raw/academy/**`, avec le secret `COURSES_APP_DISPATCH_TOKEN`.
  L'URL Supabase est en clair dans l'action (elle l'est déjà dans le bundle du front).
- Run CI n°2 réussi le 2026-10-13 (sira + tajwid publiés). yt-dlp échoue sur les serveurs
  GitHub (blocage YouTube) : les chapitres sont donc mis en cache dans `tools/chapters/`
  (commité), à remplir en local avec `--refresh-chapters` pour tout nouveau cours. Un cours
  peut être retenu hors ligne avec `"publish": false` dans `tools/overrides.json`.
- Étape 6 (2026-10-13) : `/admin` = connexion Supabase Auth (e-mail + mot de passe, utilisateur
  créé dans le tableau de bord Supabase), liste blanche `public.admins` vérifiée par la fonction
  `is_admin()` (`supabase/admin.sql`, à exécuter après `schema.sql`). Liste de tous les cours,
  formulaire (métadonnées, dépôt de resume.md / anki.tsv / mindmap.json, aperçu), publier /
  dépublier, bascule `manual` / `pipeline`, suppression. Un cours créé à la main naît en
  `manual` et non publié. Les analyses de fichiers (`src/lib/admin.js`) reproduisent
  `publish.py` (guid = sha1(id + question normalisée)[:16], frontmatter retiré, chapitres
  depuis les marqueurs des titres). Pas d'alignement d'horodatages côté admin.
- Étape 6 validée le 2026-10-14 avec un administrateur de test temporaire (créé puis supprimé
  via l'API admin de Supabase Auth) : connexion, création d'un cours, dépôt des trois
  fichiers, aperçu, sauvegarde, publication, dépublication, suppression. `admin.sql` donne
  aussi `grant all on admins to service_role`. Une barrière d'erreur globale
  (`ErrorBoundary.jsx`) remplace la page blanche en cas d'exception de rendu.
- Étape 7 faite le 2026-10-14 dans `ar_audioToMd` : `make_cards.py` écrit une 4e colonne
  `guid` (sha1(id du cours + question sans tashkeel)[:16], identique au repli de
  `publish.py`), `make_anki.py` l'utilise comme guid de note Anki ; `draft_lesson.py
  --mode mindmap` produit `mindmap.json` (schéma validé, profondeur ≤ 4) et `mindmap.md`
  (bloc Mermaid pour Obsidian) à partir de `resume-ok.md` ; `pull_sources.py` laisse `speaker`
  vide quand le titre n'a pas de « | ». Essai sur la sira : 11 nœuds, 20 questions, 48 s.
- Carte mentale de la sira (2026-10-14) : celle d'Abdelali, extraite de `docs/miniApp.html`
  (48 nœuds, 23 questions), chargée dans Supabase à la main ; copie dans
  `ar_audioToMd/temp/mindmap-Y2iDJNpa7wg.json` à déposer dans le dossier du cours du vault.
  Tant que le vault n'a pas de `mindmap-ok.json`, `publish.py` ne touche pas à la table `mindmaps`.
- Carte mentale (2026-10-14) : vue « الخريطة » horizontale comme miniApp (racine à droite,
  connecteurs CSS en pseudo-éléments, couleur par branche) par défaut au-dessus de 700 px,
  vue « القائمة » (plan) sinon ; sélecteur dans la barre d'outils. Pas de vue révision dans la
  carte (demande du 2026-10-14) : la révision est l'onglet المراجعة du cours.
- `/admin` (2026-10-14) : éditeur « أوقات العناوين » dans le formulaire d'un cours : un champ
  de temps par titre du résumé (marqueurs `[m:ss]`), lien ▶ vers la vidéo à cet instant,
  « حفظ الأوقات » (met à jour `summary_md` seulement, pas la table `chapters`) et
  « تنزيل resume-ok.md بالأوقات » pour remettre le fichier dans le vault, où les marqueurs
  manuels sont conservés par `align.py`. En mode `pipeline`, le prochain run recalcule.
- Typographie de lecture (2026-10-14, demande de l'utilisateur) : `--f-read` = Noto Naskh
  Arabic (Google Fonts) pour les paragraphes du résumé, les cartes de révision, le QCM et
  les éléments de la carte mentale : 1.2rem, interligne 2.15, `word-spacing: 0.12em`.
  Jamais de `letter-spacing` en arabe (casse les liaisons). Titres toujours en Amiri,
  interface en IBM Plex Sans Arabic.
- Résumé en accordéons (2026-10-14) : chaque titre de niveau 2 ouvre ou ferme sa section
  (fermées au chargement, introduction sans titre toujours visible), boutons « فتح الكل » /
  « طي الكل » et compteur. Les titres de niveau 3 restent dans leur section.
- Typographie réglable (2026-10-14, demande de l'utilisateur) : table `public.settings` (`supabase/settings.sql`,
  à exécuter après `admin.sql` ; lecture publique, écriture admins), clé `typography` =
  `{read, display, body, readSize, readLineHeight, wordSpacing}`. `src/lib/settings.js` : liste `FONTS`
  (Google Fonts chargées à la demande), `loadTypography()` appelé par `Layout` (cache localStorage puis base),
  `applyTypography()` pose `--f-read`, `--f-display`, `--f-body`, `--read-size`, `--read-lh`, `--read-ws`
  sur `:root`. Panneau « الإعدادات · الخطوط » en tête de `/admin` (`src/admin/TypographySettings.jsx`), aperçu
  en direct, « حفظ », « الافتراضي ». Sans ligne en base, les valeurs par défaut du CSS s'appliquent.
- Résumé : les titres de niveau 3 sont des accordéons imbriqués dans ceux de niveau 2 (`splitAt` dans
  `SummaryTab.jsx`) ; le texte d'une section placé avant son premier `###` reste visible quand elle est ouverte.
- Mobile d'abord (2026-10-14, la plupart des élèves n'ont qu'un téléphone) : bloc `@media (max-width: 600px)`
  dans `index.css` (corps 16 px contre le zoom iOS, cibles tactiles ≥ 40 px, boutons de révision pleine
  largeur, onglets du cours collants et défilants, interligne × 0.88 via `--lh-k`, marges réduites, zones
  sûres `env(safe-area-inset-*)`, `viewport-fit=cover`) et bloc paysage (`max-height: 520px`) qui compacte
  l'en-tête du cours. Carte mentale : la vue carte est réduite à l'échelle (`zoom` CSS, plancher 0.55,
  `ResizeObserver`) pour tenir dans le cadre sans défilement ; le détail d'un nœud reste en colonne à gauche
  dès 601 px (téléphone à l'horizontale compris, colonne 240 à 300 px) et s'ouvre en tiroir fixé au bord
  gauche en dessous (`.detail.sheet`, fermeture ✕ ou fond). Hook `src/lib/useMedia.js` (`useMediaQuery`).
  Contrôle avec Playwright à 390×844 et 844×390 (émulation iPhone 13) : aucun débordement horizontal.
- 2026-10-14, demande de l'utilisateur : **`SHOW_TIMESTAMPS = true`** (horodatages sur les titres du résumé,
  sommaire des chapitres, lecteur à la demande). `SHOW_VIDEO_TAB` reste `false`. Sur téléphone, le lecteur
  collant se place sous la barre d'onglets en portrait et s'ancre en vignette fixe en bas à gauche en paysage,
  pour lire le résumé pendant la vidéo.
- **Vidéos retirées (2026-10-14)**, après vérification demandée par l'utilisateur : les trois vidéos sont
  *non répertoriées* sur la chaîne YouTube de l'académie, et le règlement intérieur
  (<https://albajiacademy.com/rules/>, art. 36-11 « عدم نشر تسجيلات الدروس أو تفريغاتها أو المواد التعليمية
  خارج المنصة دون إذن », 36-13 partage interdit, 41-2 copie et rediffusion soumises à autorisation) interdit
  leur diffusion hors plateforme. `SHOW_TIMESTAMPS` et `SHOW_VIDEO_TAB` à `false`, `WANT_VIDEO` dans
  `src/config.js` : le front ne lit plus `youtube_url` ni `chapters`. `supabase/hide_video.sql` (à exécuter)
  retire à `anon` la colonne `youtube_url` et la table `chapters` ; admins et `service_role` gardent tout.
  Le site ne garde que résumés, cartes et cartes mentales produits par les étudiants. Zones grises
  signalées à l'utilisateur : résumés dérivés des enregistrements, nœuds de la carte mentale sourcés
  « خ » (carte de l'académie), références « ص N » au fichier du cours, nom « الأكاديمية » dans le titre du site.
- Levée des ambiguïtés (2026-10-14, accord de l'utilisateur « ok pour toute action ») : site renommé
  **« مراجعة الدروس »** (titre, bandeau, accueil, README) pour ne pas suggérer un lien officiel (art. 41-3) ;
  page « عن الموقع » et pied de page affirment : travail d'étudiants indépendant, ne représente pas
  l'académie, ne publie ni enregistrements ni supports, retrait sur demande via les issues GitHub.
  `hide_video.sql` exécuté par l'utilisateur ; vérifié : `anon` reçoit 42501 sur `youtube_url` et `chapters`.
- Métadonnées de partage (2026-10-14) : description, balises Open Graph et Twitter dans `index.html`,
  image `public/og.png` (1200×630, rendue avec Playwright depuis un HTML du scratchpad). Les messageries
  (Telegram, WhatsApp) gardent l'ancien aperçu en cache : pour Telegram, envoyer l'URL à @WebpageBot.
- Convention « -ok » appliquée dans `publish.py` (2026-10-14, demande de l'utilisateur) : fichiers relus
  `resume-ok.md`, `anki-ok.tsv` (repli `anki.tsv`, cas de la sira) et `mindmap-ok.json` (seul fichier de carte
  lu). Renommés `resume.md`, `anki.tsv`, `mindmap.json` dans Storage. Fixture renommée en conséquence.
  Tajwid `aDsOW0pQwbw` republié en local avec sa carte mentale (53 cartes). Le vault local a des changements
  non poussés : tant qu'ils ne le sont pas, le cron CI republie l'ancien `anki.tsv` du dépôt distant.
- Ordre des matières (2026-10-14, demande de l'utilisateur) : sira, tajwid, aqida, nahw, fiqh, sarf
  (`subjects.position`, mis à jour en base et dans le seed de `schema.sql`).
- Matière الصرف retirée (2026-10-14, demande de l'utilisateur) : ligne supprimée de `subjects`, du seed et de `publish.py`.
- Leitner (2026-10-18, demande de l'utilisateur) : une carte nouvelle sue va directement en boîte 2 (3 jours),
  une carte ratée en boîte 1 (1 jour) ; avant, les deux réponses menaient en boîte 1 et la barre se colorait
  pareil. Intervalles inchangés : 0, 1, 3, 7, 14, 30 jours.
- Révision (2026-10-18) : sous la barre, chaque boîte non vide indique l'échéance de sa prochaine carte (« الآن », « غدا », « بعد N أيام »), `boxNextDue` et `dueLabel` dans `progress.js`.
- CI (2026-10-19) : `runs-on: ubuntu-24.04` épinglé dans `publish.yml` (fin de l'avis « ubuntu-latest → Ubuntu 26 ») ; à faire évoluer volontairement.
- Suggestions des élèves (2026-10-19, demande de l'utilisateur, trois volets) :
  1. `supabase/suggestions.sql` (à exécuter après `admin.sql`) : table `suggestions` (cours, onglet, emplacement,
     type, texte d'origine, proposition, auteur, statut new/reviewed/accepted/rejected/applied, `fix`, note),
     table `reviewers` + `is_reviewer()`, fonctions publiques `applied_suggestions(course_id)` et
     `contributors()`. `anon` : insertion seule. Bouton « ✎ اقترح تصحيحا » (`SuggestButton.jsx`, `lib/suggest.js`,
     piège à robots, 20 s entre deux envois, nom mémorisé) sous chaque section du résumé, sous la réponse d'une
     carte, dans le détail d'un nœud. Remarque en arabe sous les onglets du cours ; compteur « N تصحيح من الطلبة »
     dans les métadonnées ; contributeurs cités sur « عن الموقع ».
  2. Page `/contribute` « كيف تساهم » (3 étapes, captures `public/contrib-1.png` et `contrib-2.png` faites avec
     Playwright sur l'aperçu local), liens dans le pied de page et « عن الموقع ».
  3. `/admin` : section « اقتراحات الطلبة » (`admin/Suggestions.jsx`) en tête, filtres قيد المعالجة / المنتهية,
     original et proposition côte à côte, éditeur du texte corrigé (section Markdown entière, ou question +
     réponse pour une carte), « حفظ المراجعة », « قبول وتطبيق » (admin : `applySuggestion` remplace la section
     dans `summary_md` ou la carte par guid, passe le cours en `manual`, propose le fichier `resume-ok.md` ou
     `anki-ok.tsv` à remettre dans le vault ; carte mentale : marquage seul, correction à la main dans
     `mindmap-ok.json`), « رفض », « حذف ». Rôle relecteur : compte Auth + e-mail dans `reviewers`
     (panneau « المراجعون ») ; il ne voit que les suggestions et ne peut que préparer le texte.
     Règle : le vault reste la source ; après application, remettre le fichier dans le vault puis repasser le
     cours en `pipeline`, sinon il reste figé.
- Thème (2026-10-19, demande de l'utilisateur) : bouton soleil / lune dans la barre du haut (`ThemeToggle.jsx`, `lib/theme.js`, clé `ar_coursesApp.theme`), appliqué avant le premier rendu par un script inline de `index.html` ; sans choix, le thème suit le système.
- Constructeur de carte mentale (2026-10-20, demande de l'utilisateur, « comme roadmap.sh mais simple », côté admin) :
  `src/admin/MindmapBuilder.jsx`, ouvert depuis le formulaire d'un cours existant (« إنشاء / تحرير الخريطة في المنشئ »,
  arbre chargé par `loadMindmap`). Plan à droite (sélection), éditeur du nœud à gauche : titre, numéro, explications
  (tag, texte, source), questions ; boutons + فرع / + أخ / ↑ ↓ / إدخال / إخراج / حذف, raccourcis Enter (frère), Tab
  (rentrer), Shift+Tab (sortir) dans le champ titre ; « إضافة فروع من نص » (une ligne = un fils, deux espaces = un
  sous-niveau, « 1. » = numéro, « ? q = r » = question, « = … » = explication) ; aperçu avec `MindmapTab` (prop
  `onPick` : un clic sur un nœud revient en édition dessus) ; brouillon automatique dans localStorage
  (`ar_coursesApp.builder.<id>`, proposé à la réouverture) ; import JSON, « تنزيل mindmap-ok.json », « خريطة جديدة ».
  « حفظ الخريطة في القاعدة » : upsert `mindmaps` + `mindmap.json` dans Storage ; le vault reste la source : remettre
  `mindmap-ok.json` dans le dossier du cours (ou figer le cours en `manual`), sinon le prochain run CI le remplace s'il
  trouve un `mindmap-ok.json` dans le vault. Vérifié avec Playwright (bureau 1280 et 390×844) sur un cours temporaire.
  Types d'explication choisis par pastilles colorées (`.chip`, couleurs de `TAGS` exporté par `MindmapTab.jsx`) ;
  la carte de la sira (48 nœuds, sources parfois numériques) se recharge et se réexporte sans perte (vérifié).
  Accès (2026-10-20) : colonne « الخريطة » dans la liste des cours de `/admin` (« + إنشاء الخريطة » en doré si aucune
  carte, « تحرير الخريطة » sinon, `listMindmapIds`) qui ouvre le formulaire directement sur le constructeur (prop
  `openBuilder` de `CourseForm`, défilement automatique).
- Safe Browsing (2026-10-20) : Chrome affiche « Dangereux » sur coursesapp-lac.vercel.app ; le rapport de transparence
  Google (`transparencyreport.google.com/transparencyreport/api/v3/safebrowsing/status?site=…`) donne le statut 3 (site
  signalé, drapeau de hameçonnage probable, horodatage du 2026-10-19). Cause probable : formulaire e-mail + mot de passe
  de `/admin` sur un sous-domaine vercel.app. À faire par l'utilisateur : signalement d'erreur
  <https://safebrowsing.google.com/safebrowsing/report_error/> et demande de réexamen dans Google Search Console
  (propriété vérifiée par balise `google-site-verification` à poser dans `index.html`). Solution durable : nom de domaine
  propre.
- Connexion `/admin` par lien magique (2026-10-20, pour retirer le champ mot de passe qui a probablement déclenché le
  signalement Safe Browsing) : `sendMagicLink(email)` (`signInWithOtp`, `shouldCreateUser: false`, retour sur
  `/admin`) et `verifyCode(email, code)` (`verifyOtp` type `email`) dans `lib/admin.js`. Le formulaire n'a qu'un champ
  e-mail ; après envoi, même message pour une adresse inconnue (pas d'énumération), champ facultatif pour le code du
  courriel (8 chiffres dans ce projet). Flux implicite (défaut de supabase-js) : le lien marche depuis n'importe quel
  navigateur. **Côté Supabase, à régler par l'utilisateur** : Authentication → URL Configuration → Site URL
  `https://coursesapp-lac.vercel.app` et Redirect URLs `https://coursesapp-lac.vercel.app/**` (sinon le lien renvoie
  sur `http://localhost:3000`, valeur constatée le 2026-10-20) ; pour que le code figure dans le courriel, ajouter
  `{{ .Token }}` au modèle « Magic Link ». Le SMTP intégré de Supabase est limité à quelques envois par heure.
  Vérifié avec Playwright : lien (jetons dans le fragment, retirés de l'URL, session conservée) et code.
- Références de page retirées (2026-10-20, demande de l'utilisateur, avant l'envoi de la demande d'autorisation à
  l'académie, `docs/demande-autorisation.md`) : le front n'affiche plus jamais une source numérique « ص N » (référence au
  fichier de cours de l'académie), seules « خ » et « + » sont rendues ; légende sans l'entrée page ; dans le constructeur,
  la source est un sélecteur — / خ / + et `clean()` vide toute source numérique à l'export. Seule la carte de la sira
  (Y2iDJNpa7wg, celle d'Abdelali) en contenait : 95 pages, 10 « خ », 3 « + ». Les autres cartes ont des sources vides
  (le générateur `draft_lesson.py --mode mindmap` écrit toujours ""). Le 2026-10-20, la carte de la sira
  a été nettoyée en base et dans Storage (service_role, 95 pages → sources vides, 48 nœuds intacts) ; le fichier
  nettoyé est dans `ar_audioToMd/temp/mindmap-ok-Y2iDJNpa7wg.json`, à déposer par l'utilisateur sous le nom
  `mindmap-ok.json` dans le dossier de la sira du vault (`raw/youtube/2022-09-15-15-13 … [Y2iDJNpa7wg]/`). Reste à
  statuer sur les 10 éléments « خ » repris de la carte de l'académie.

