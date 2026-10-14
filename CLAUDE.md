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
- Secrets : `.env.local` (front, clés `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) hors
  git ; `SUPABASE_SERVICE_ROLE_KEY` et le jeton de lecture du vault uniquement dans les
  secrets GitHub.
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
