-- Schéma ar_coursesApp — à coller tel quel dans l'éditeur SQL de Supabase (idempotent).
-- Lecture publique (clé anon) limitée aux cours publiés ; écriture réservée à la clé
-- service_role (tools/publish.py) et, plus tard, au tableau de bord /admin.

create table if not exists public.subjects (
  id        text primary key,           -- slug latin : sira, fiqh, tajwid, aqida, nahw, sarf
  name_ar   text not null,
  position  integer not null default 0
);

create table if not exists public.courses (
  id           text primary key,        -- identifiant YouTube ou identifiant plateforme
  subject_id   text not null references public.subjects(id),
  number       integer,
  title        text not null,
  teacher      text,
  date         date,
  duration     text,                    -- hh:mm:ss tel que fourni par meta.md
  youtube_url  text,
  summary_md   text,
  published    boolean not null default false,
  managed_by   text not null default 'pipeline' check (managed_by in ('pipeline', 'manual')),
  updated_at   timestamptz not null default now()
);
create index if not exists courses_subject_idx on public.courses (subject_id, number);

create table if not exists public.cards (
  guid       text primary key,
  course_id  text not null references public.courses(id) on delete cascade,
  question   text not null,
  answer     text not null,
  tags       text[] not null default '{}',
  position   integer not null default 0
);
create index if not exists cards_course_idx on public.cards (course_id, position);

create table if not exists public.mindmaps (
  course_id  text primary key references public.courses(id) on delete cascade,
  tree       jsonb not null
);

create table if not exists public.chapters (
  course_id  text not null references public.courses(id) on delete cascade,
  seconds    integer not null,
  title      text not null,
  primary key (course_id, seconds)
);

-- Matières de départ (CLAUDE.md). L'ordre d'affichage suit position.
insert into public.subjects (id, name_ar, position) values
  ('sira',   'السيرة النبوية',    1),
  ('fiqh',   'الفقه',             2),
  ('tajwid', 'التجويد',           3),
  ('aqida',  'التوحيد والعقيدة',  4),
  ('nahw',   'النحو',             5),
  ('sarf',   'الصرف',             6)
on conflict (id) do update set name_ar = excluded.name_ar, position = excluded.position;

-- RLS : tout est fermé par défaut, on n'ouvre que la lecture des lignes publiées.
alter table public.subjects enable row level security;
alter table public.courses  enable row level security;
alter table public.cards    enable row level security;
alter table public.mindmaps enable row level security;
alter table public.chapters enable row level security;

drop policy if exists "subjects_public_read" on public.subjects;
create policy "subjects_public_read" on public.subjects
  for select to anon, authenticated using (true);

drop policy if exists "courses_public_read" on public.courses;
create policy "courses_public_read" on public.courses
  for select to anon, authenticated using (published);

drop policy if exists "cards_public_read" on public.cards;
create policy "cards_public_read" on public.cards
  for select to anon, authenticated
  using (exists (select 1 from public.courses c where c.id = course_id and c.published));

drop policy if exists "mindmaps_public_read" on public.mindmaps;
create policy "mindmaps_public_read" on public.mindmaps
  for select to anon, authenticated
  using (exists (select 1 from public.courses c where c.id = course_id and c.published));

drop policy if exists "chapters_public_read" on public.chapters;
create policy "chapters_public_read" on public.chapters
  for select to anon, authenticated
  using (exists (select 1 from public.courses c where c.id = course_id and c.published));

-- Bucket Storage « content », public en lecture (URLs publiques, pas d'URL signée).
-- Chemin : content/<subject>/<course_id>/{resume.md, anki.tsv, mindmap.json}.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('content', 'content', true, 20971520,
        array['text/markdown', 'text/plain', 'text/tab-separated-values', 'application/json'])
on conflict (id) do update set public = true,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Lecture publique des objets du bucket (nécessaire pour lister ; le téléchargement
-- par URL publique marche déjà grâce à public = true).
drop policy if exists "content_public_read" on storage.objects;
create policy "content_public_read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'content');
