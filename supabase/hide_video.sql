-- 2026-10-14 : vidéos retirées du site public (règlement de l'académie, vidéos non répertoriées).
-- Le rôle anon ne voit plus youtube_url ni la table chapters ; les admins (authenticated) gardent tout
-- pour le tableau de bord, service_role aussi pour publish.py.
revoke select on public.courses from anon;
grant select (id, subject_id, number, title, teacher, date, duration, summary_md, published, managed_by, updated_at)
  on public.courses to anon;
revoke select on public.chapters from anon;
