-- Droits d'écriture pour le tableau de bord /admin (étape 6). À exécuter après schema.sql.
-- Principe : un utilisateur Supabase Auth connecté n'a de droits que si son e-mail figure
-- dans public.admins. Les étudiants (clé anon, pas de session) ne sont pas concernés.

create table if not exists public.admins (
  email text primary key
);
alter table public.admins enable row level security;

-- Fonction utilisable dans les règles RLS : vrai si l'e-mail du jeton est dans admins.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where email = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Un admin peut lire la liste blanche (pour afficher son statut), personne ne l'édite depuis l'appli.
drop policy if exists "admins_self_read" on public.admins;
create policy "admins_self_read" on public.admins for select to authenticated using (public.is_admin());
grant select on public.admins to authenticated;

-- Tables de contenu : lecture de tout (y compris non publié) et écriture pour les admins.
grant insert, update, delete on public.courses, public.cards, public.mindmaps, public.chapters to authenticated;

drop policy if exists "courses_admin_all" on public.courses;
create policy "courses_admin_all" on public.courses for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "cards_admin_all" on public.cards;
create policy "cards_admin_all" on public.cards for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "mindmaps_admin_all" on public.mindmaps;
create policy "mindmaps_admin_all" on public.mindmaps for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "chapters_admin_all" on public.chapters;
create policy "chapters_admin_all" on public.chapters for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Bucket content : dépôt et remplacement des fichiers par les admins.
drop policy if exists "content_admin_write" on storage.objects;
create policy "content_admin_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'content' and public.is_admin());
drop policy if exists "content_admin_update" on storage.objects;
create policy "content_admin_update" on storage.objects for update to authenticated
  using (bucket_id = 'content' and public.is_admin()) with check (bucket_id = 'content' and public.is_admin());
drop policy if exists "content_admin_delete" on storage.objects;
create policy "content_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'content' and public.is_admin());

-- Liste blanche : remplacer par les e-mails des administrateurs (en minuscules).
insert into public.admins (email) values ('najib3ilm@gmail.com') on conflict do nothing;
