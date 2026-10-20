# ar_coursesApp — مراجعة الدروس

Site : <https://coursesapp-lac.vercel.app/>

Site de révision tenu par des étudiants, indépendant de l'académie : pour chaque cours, un
résumé, des cartes de révision tirées des decks Anki et une
carte mentale dépliable. Interface en arabe, lecture de droite à gauche.

Troisième dépôt du projet, aux côtés de `ar_audioToMd` (pipeline de production du contenu)
et `secondBrain` (vault Obsidian, source de vérité). Les décisions d'architecture sont dans
[CLAUDE.md](CLAUDE.md).

## Crédit

L'interface repart de `miniApp.html`, une ébauche d'application
conçue par **Abdelali**, étudiant de l'académie, avec l'aide de Claude. Il a donné son accord
le 2026-10-13 pour qu'elle soit reprise et enrichie ici. Le fichier original est conservé en local (hors git)
dans `docs/` ; on en garde la mise en page RTL (Amiri, IBM Plex Sans Arabic), l'arbre
dépliable, la vue révision, la recherche et le schéma de nœud de la carte mentale.

## Stack

- Front : React + Vite, hébergé sur Vercel.
- Données : Supabase (Postgres, Storage, Auth), lues avec la clé `anon` sous RLS.
- Alimentation : GitHub Actions + `tools/publish.py`, qui lit le vault et remplit Supabase.
- Progression des étudiants : `localStorage`, exportable et importable en JSON.

## Développement

```bash
cp .env.example .env.local   # puis renseigner l'URL et la clé anon Supabase
npm install
npm run dev
```

`npm run build` produit le site statique dans `dist/`. Aucun contenu de cours n'est
commité ici : il vit dans Supabase.

## Licence du contenu

Le code de ce dépôt est public ; le contenu (résumés, cartes, cartes mentales) est produit par
les étudiants pour leur révision et n'est pas inclus dans le dépôt. Le site ne diffuse ni les
enregistrements des cours ni les supports de l'académie, conformément à son règlement intérieur
(<https://albajiacademy.com/rules/>), et ne la représente pas. Toute demande de retrait d'un
contenu peut être faite dans les issues de ce dépôt.

## Autorisation de l'académie

Une demande d'autorisation écrite a été envoyée à l'administration de l'académie le
2026-10-20 ; son texte est dans [docs/demande-autorisation.md](docs/demande-autorisation.md).
**Réponse : en attente.** Elle sera consignée ici et dans ce fichier dès réception, avec les
conditions éventuelles, qui seront appliquées au site.
