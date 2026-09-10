alter table public.package_releases add column thumbnail_path text;

create table public.package_reports (
  id bigint generated always as identity primary key,
  release_id uuid not null references public.package_releases(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 500),
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (release_id, reporter_id)
);

create trigger package_reports_updated_at before update on public.package_reports
for each row execute function public.set_updated_at();

alter table public.package_reports enable row level security;
revoke all on public.package_reports from anon, authenticated;

drop view public.community_catalog;
create view public.community_catalog
with (security_barrier = true)
as
select
  r.id as release_id,
  r.package_id,
  r.version,
  r.manifest,
  r.manifest->>'name' as name,
  r.manifest->>'description' as description,
  r.manifest->>'geometry' as geometry,
  coalesce(r.manifest->'permissions', '[]'::jsonb) as permissions,
  r.manifest->>'minimumAppVersion' as minimum_app_version,
  r.sha256,
  r.byte_size,
  r.published_at,
  p.username::text as publisher_username,
  r.approved_native,
  r.thumbnail_path,
  r.owner_id = auth.uid() as owned
from public.package_releases r
join public.profiles p on p.id = r.owner_id
where r.status = 'published' and p.username is not null;

grant select on public.community_catalog to anon, authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('package-thumbnails', 'package-thumbnails', true, 2097152, array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

