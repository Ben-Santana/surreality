create table public.package_saves (
  user_id uuid not null references auth.users(id) on delete cascade,
  release_id uuid not null references public.package_releases(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, release_id)
);

alter table public.package_saves enable row level security;
create policy "saves_select_own" on public.package_saves for select to authenticated
using (user_id = (select auth.uid()));
revoke all on public.package_saves from anon, authenticated;
grant select on public.package_saves to authenticated;

drop policy "releases_select_visible" on public.package_releases;
create policy "releases_select_visible" on public.package_releases for select
using (
  status = 'published'
  or owner_id = (select auth.uid())
  or public.is_app_admin()
  or exists (
    select 1 from public.package_downloads d
    where d.release_id = package_releases.id and d.user_id = (select auth.uid())
  )
  or exists (
    select 1 from public.package_saves s
    where s.release_id = package_releases.id and s.user_id = (select auth.uid())
  )
);

create or replace view public.community_catalog
with (security_barrier = true)
as
select
  r.id as release_id,
  r.package_id,
  r.version,
  r.manifest,
  coalesce(r.listing_name, r.manifest->>'name') as name,
  coalesce(r.listing_description, r.manifest->>'description') as description,
  r.manifest->>'geometry' as geometry,
  coalesce(r.manifest->'permissions', '[]'::jsonb) as permissions,
  r.manifest->>'minimumAppVersion' as minimum_app_version,
  r.sha256,
  r.byte_size,
  r.published_at,
  p.username::text as publisher_username,
  r.approved_native,
  r.thumbnail_path,
  r.owner_id = auth.uid() as owned,
  r.listing_name,
  r.listing_description,
  exists (
    select 1 from public.package_saves s
    where s.release_id = r.id and s.user_id = auth.uid()
  ) as saved
from public.package_releases r
join public.profiles p on p.id = r.owner_id
where r.status = 'published' and p.username is not null;

grant select on public.community_catalog to anon, authenticated;

