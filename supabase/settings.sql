-- Réglages du site modifiables depuis /admin (typographie…). Lecture publique, écriture admins.
create table if not exists public.settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);
alter table public.settings enable row level security;
grant select on public.settings to anon, authenticated;
grant insert, update, delete on public.settings to authenticated;
grant all on public.settings to service_role;

drop policy if exists "settings_public_read" on public.settings;
create policy "settings_public_read" on public.settings for select to anon, authenticated using (true);
drop policy if exists "settings_admin_all" on public.settings;
create policy "settings_admin_all" on public.settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
