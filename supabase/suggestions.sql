-- Suggestions des élèves (2026-10-19) : bouton « اقترح تصحيحا » sur le résumé, les cartes et la carte
-- mentale. Les anonymes ne peuvent qu'insérer ; les relecteurs (table reviewers) lisent et préparent un
-- texte corrigé ; les admins acceptent, appliquent ou refusent. À exécuter après admin.sql.

create table if not exists public.suggestions (
  id          uuid primary key default gen_random_uuid(),
  course_id   text not null references public.courses (id) on delete cascade,
  tab         text not null check (tab in ('summary', 'review', 'map')),
  location    text not null default '' check (length(location) <= 500),   -- titre de section, guid de carte, chemin du nœud
  kind        text not null check (kind in ('error', 'add', 'reword', 'remove', 'other')),
  original    text not null default '' check (length(original) <= 20000), -- texte en ligne au moment de la suggestion
  proposed    text not null check (length(proposed) between 3 and 6000),  -- ce que propose l'élève
  author      text not null default '' check (length(author) <= 80),
  status      text not null default 'new' check (status in ('new', 'reviewed', 'accepted', 'rejected', 'applied')),
  fix         text check (length(fix) <= 20000),                           -- texte corrigé prêt à appliquer (relecteur ou admin)
  note        text not null default '' check (length(note) <= 2000),
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text
);
create index if not exists suggestions_status_idx on public.suggestions (status, created_at desc);
create index if not exists suggestions_course_idx on public.suggestions (course_id);
alter table public.suggestions enable row level security;

-- Relecteurs : liste blanche d'e-mails, comme admins. Un admin est aussi relecteur.
create table if not exists public.reviewers (
  email text primary key
);
alter table public.reviewers enable row level security;
create or replace function public.is_reviewer() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or exists (select 1 from public.reviewers where email = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;
revoke all on function public.is_reviewer() from public;
grant execute on function public.is_reviewer() to authenticated;

grant select, insert, delete on public.reviewers to authenticated;
grant all on public.reviewers to service_role;
drop policy if exists "reviewers_admin_all" on public.reviewers;
create policy "reviewers_admin_all" on public.reviewers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Élèves (anon) : insertion seulement, statut « new », champs de relecture vides.
grant insert on public.suggestions to anon;
drop policy if exists "suggestions_anon_insert" on public.suggestions;
create policy "suggestions_anon_insert" on public.suggestions for insert to anon
  with check (status = 'new' and fix is null and note = '' and reviewed_at is null and reviewed_by is null);

-- Relecteurs : lecture, insertion, mise à jour tant que le statut reste « new » ou « reviewed ».
grant select, insert, update, delete on public.suggestions to authenticated;
grant all on public.suggestions to service_role;
drop policy if exists "suggestions_reviewer_read" on public.suggestions;
create policy "suggestions_reviewer_read" on public.suggestions for select to authenticated using (public.is_reviewer());
drop policy if exists "suggestions_reviewer_insert" on public.suggestions;
create policy "suggestions_reviewer_insert" on public.suggestions for insert to authenticated with check (public.is_reviewer());
drop policy if exists "suggestions_reviewer_update" on public.suggestions;
create policy "suggestions_reviewer_update" on public.suggestions for update to authenticated
  using (public.is_reviewer())
  with check (public.is_admin() or status in ('new', 'reviewed'));
drop policy if exists "suggestions_admin_delete" on public.suggestions;
create policy "suggestions_admin_delete" on public.suggestions for delete to authenticated using (public.is_admin());

-- Les relecteurs doivent pouvoir lire tous les cours (même non publiés) pour relire dans leur contexte.
drop policy if exists "courses_reviewer_read" on public.courses;
create policy "courses_reviewer_read" on public.courses for select to authenticated using (public.is_reviewer());
drop policy if exists "cards_reviewer_read" on public.cards;
create policy "cards_reviewer_read" on public.cards for select to authenticated using (public.is_reviewer());

-- Compteurs publics (anon) sans exposer les suggestions elles-mêmes.
create or replace function public.applied_suggestions(p_course_id text) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::integer from public.suggestions where course_id = p_course_id and status = 'applied';
$$;
create or replace function public.contributors() returns setof text
language sql stable security definer set search_path = public as $$
  select distinct author from public.suggestions where status = 'applied' and author <> '' order by author;
$$;
revoke all on function public.applied_suggestions(text) from public;
revoke all on function public.contributors() from public;
grant execute on function public.applied_suggestions(text) to anon, authenticated;
grant execute on function public.contributors() to anon, authenticated;
