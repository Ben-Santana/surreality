alter table public.package_releases
  add column listing_tags text[] not null default '{}'
  check (
    cardinality(listing_tags) <= 3
    and listing_tags <@ array['media', 'games', 'audio', 'visuals', 'tools']::text[]
  );

update public.package_releases
set listing_tags = case package_id
  when 'room.mapping.media' then array['media']::text[]
  when 'room.mapping.dithered-media' then array['media', 'visuals']::text[]
  when 'room.mapping.ship' then array['games']::text[]
  when 'room.mapping.sound' then array['audio']::text[]
  when 'room.mapping.feynman' then array['visuals']::text[]
  else listing_tags
end
where package_id like 'room.mapping.%';

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
  ) as saved,
  r.listing_tags
from public.package_releases r
join public.profiles p on p.id = r.owner_id
where r.status = 'published' and p.username is not null;

grant select on public.community_catalog to anon, authenticated;
