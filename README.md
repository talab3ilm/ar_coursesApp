# ar_coursesApp — مراجعة الدروس

Site : <https://coursesapp-lac.vercel.app/>

Site de révision tenu par des étudiants, indépendant de l'académie : pour chaque cours, un
résumé, des cartes de révision tirées des decks Anki et une
carte mentale dépliable. Interface en arabe, lecture de droite à gauche.

## Ce que propose le site

- **Accueil** : les matières en onglets, la liste des cours de chacune.
- **Page de cours** : trois onglets, le résumé (sections dépliables), la révision (cartes à
  retourner ou questions à choix multiples, boîtes de Leitner, échéances par boîte) et la carte
  mentale (arbre dépliable, recherche insensible au tashkeel, détail de chaque nœud).
- **Progression** : enregistrée dans le navigateur, sans compte ; export et import en JSON
  pour ne rien perdre en changeant d'appareil.
- **Thème** clair ou sombre, affichage pensé d'abord pour le téléphone.

## Contribuer

Chaque section du résumé, chaque carte et chaque nœud de la carte mentale porte un bouton
« ✎ اقترح تصحيحا » : il ouvre un court formulaire, sans compte, pour signaler une erreur ou
proposer une amélioration. La démarche est décrite sur la page
[كيف تساهم](https://coursesapp-lac.vercel.app/contribute) du site. Les suggestions sont relues
par les responsables avant toute publication, et les contributeurs sont cités sur la page
« عن الموقع ». Pour un problème technique ou une demande de retrait, ouvrez une issue dans ce
dépôt.

## Crédit

L'interface repart de `miniApp.html`, une ébauche d'application
conçue par **Abdelali**, étudiant de l'académie, avec l'aide de Claude. Il a donné son accord
le 2026-10-13 pour qu'elle soit reprise et enrichie ici. Le fichier original est conservé en local (hors git)
dans `docs/` ; on en garde la mise en page RTL (Amiri, IBM Plex Sans Arabic), l'arbre
dépliable, la vue révision, la recherche et le schéma de nœud de la carte mentale.

## Stack

- Front : React + Vite, hébergé sur Vercel.
- Données : Supabase (Postgres, Storage, Auth), lues avec la clé `anon` sous RLS.
- Publication du contenu : script `tools/publish.py`, lancé par GitHub Actions, qui remplit Supabase.
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
