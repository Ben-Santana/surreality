alter table public.package_releases
  add column listing_name text check (listing_name is null or char_length(listing_name) between 1 and 80),
  add column listing_description text check (listing_description is null or char_length(listing_description) <= 500);

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
  r.listing_description
from public.package_releases r
join public.profiles p on p.id = r.owner_id
where r.status = 'published' and p.username is not null;

grant select on public.community_catalog to anon, authenticated;

