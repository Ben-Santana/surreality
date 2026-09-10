-- Surreality community library. This intentionally refuses to discard legacy
-- cloud-sync data; local SQLite data is unrelated and is never touched here.
do $$
begin
  if exists (select 1 from public.spaces limit 1)
    or exists (select 1 from public.assets limit 1)
    or exists (select 1 from public.packages limit 1)
    or exists (
      select 1 from storage.objects
      where bucket_id in ('user-assets', 'user-packages')
      limit 1
    ) then
    raise exception 'Legacy cloud data exists. Export or remove it before applying the community-library migration.';
  end if;
end;
$$;

drop table public.spaces;
drop table public.assets;
drop table public.packages;
drop policy if exists "user_assets_select_own" on storage.objects;
drop policy if exists "user_assets_insert_own" on storage.objects;
drop policy if exists "user_assets_update_own" on storage.objects;
drop policy if exists "user_assets_delete_own" on storage.objects;

create extension if not exists citext with schema extensions;

alter table public.profiles
  add column username extensions.citext,
  add constraint profiles_username_format check (
    username is null or username::text ~ '^[a-z0-9][a-z0-9_-]{1,28}[a-z0-9]$'
  );
create unique index profiles_username_unique on public.profiles(username) where username is not null;

create table public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.package_namespaces (
  package_id text primary key check (package_id ~ '^[a-z0-9]+([._-][a-z0-9]+)+$'),
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.package_releases (
  id uuid primary key default gen_random_uuid(),
  package_id text not null references public.package_namespaces(package_id) on delete restrict,
  owner_id uuid not null references auth.users(id) on delete restrict,
  version text not null check (version ~ '^\d+\.\d+\.\d+([-+][0-9A-Za-z.-]+)?$'),
  manifest jsonb not null,
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  byte_size bigint not null check (byte_size between 1 and 52428800),
  storage_path text not null unique,
  status text not null check (status in ('published', 'pending_review', 'rejected', 'taken_down')),
  status_reason text check (status_reason is null or char_length(status_reason) <= 500),
  approved_native boolean not null default false,
  published_at timestamptz,
  taken_down_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (package_id, version),
  unique (package_id, sha256),
  constraint release_owner_matches_namespace check (owner_id is not null)
);
create index package_releases_catalog on public.package_releases(status, published_at desc);
create index package_releases_owner on public.package_releases(owner_id, created_at desc);

create table public.package_downloads (
  user_id uuid not null references auth.users(id) on delete cascade,
  release_id uuid not null references public.package_releases(id) on delete restrict,
  first_downloaded_at timestamptz not null default now(),
  last_downloaded_at timestamptz not null default now(),
  download_count integer not null default 1 check (download_count > 0),
  primary key (user_id, release_id)
);

create table public.moderation_actions (
  id bigint generated always as identity primary key,
  release_id uuid not null references public.package_releases(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('approve', 'reject', 'take_down', 'restore')),
  reason text check (reason is null or char_length(reason) <= 500),
  created_at timestamptz not null default now()
);

create table public.community_rate_limits (
  bucket text not null,
  subject_hash text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 1,
  primary key (bucket, subject_hash, window_started_at)
);

create trigger package_releases_updated_at before update on public.package_releases
for each row execute function public.set_updated_at();

create or replace function public.is_app_admin(candidate uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select candidate is not null and exists (
    select 1 from public.app_admins where user_id = candidate
  );
$$;

create or replace function public.set_public_username(next_username text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized text := lower(trim(next_username));
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if normalized !~ '^[a-z0-9][a-z0-9_-]{1,28}[a-z0-9]$' then
    raise exception 'Username must be 3-30 characters using letters, numbers, underscore, or hyphen';
  end if;
  update public.profiles set username = normalized where id = auth.uid();
  return normalized;
end;
$$;

create or replace view public.community_catalog
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
  r.approved_native
from public.package_releases r
join public.profiles p on p.id = r.owner_id
where r.status = 'published' and p.username is not null;

alter table public.app_admins enable row level security;
alter table public.package_namespaces enable row level security;
alter table public.package_releases enable row level security;
alter table public.package_downloads enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.community_rate_limits enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_public_or_own" on public.profiles for select
using (username is not null or id = (select auth.uid()));
create policy "admins_select_self" on public.app_admins for select to authenticated
using (user_id = (select auth.uid()));
create policy "namespaces_select_visible" on public.package_namespaces for select
using (
  owner_id = (select auth.uid()) or public.is_app_admin() or exists (
    select 1 from public.package_releases r
    where r.package_id = package_namespaces.package_id and r.status = 'published'
  )
);
create policy "releases_select_visible" on public.package_releases for select
using (
  status = 'published'
  or owner_id = (select auth.uid())
  or public.is_app_admin()
  or exists (
    select 1 from public.package_downloads d
    where d.release_id = package_releases.id and d.user_id = (select auth.uid())
  )
);
create policy "downloads_select_own" on public.package_downloads for select to authenticated
using (user_id = (select auth.uid()) or public.is_app_admin());
create policy "moderation_select_admin" on public.moderation_actions for select to authenticated
using (public.is_app_admin());

revoke all on public.app_admins, public.package_namespaces, public.package_releases,
  public.package_downloads, public.moderation_actions, public.community_rate_limits from anon, authenticated;
grant select on public.package_namespaces, public.package_releases to authenticated;
grant select on public.package_downloads to authenticated;
grant select on public.app_admins, public.moderation_actions to authenticated;
grant select (id, username) on public.profiles to authenticated;
grant select on public.community_catalog to anon, authenticated;
grant execute on function public.set_public_username(text) to authenticated;
grant execute on function public.is_app_admin(uuid) to anon, authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('user-packages', 'user-packages', false, 52428800, array['application/vnd.surreality.package+json','application/json','application/octet-stream'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "user_packages_select_own" on storage.objects;
drop policy if exists "user_packages_insert_own" on storage.objects;
drop policy if exists "user_packages_update_own" on storage.objects;
drop policy if exists "user_packages_delete_own" on storage.objects;
create policy "package_staging_insert_own" on storage.objects for insert to authenticated
with check (
  bucket_id = 'user-packages'
  and (storage.foldername(name))[1] = 'staging'
  and (storage.foldername(name))[2] = (select auth.uid())::text
);
create policy "package_staging_select_own" on storage.objects for select to authenticated
using (
  bucket_id = 'user-packages'
  and (storage.foldername(name))[1] = 'staging'
  and (storage.foldername(name))[2] = (select auth.uid())::text
);
create policy "package_staging_update_own" on storage.objects for update to authenticated
using (
  bucket_id = 'user-packages'
  and (storage.foldername(name))[1] = 'staging'
  and (storage.foldername(name))[2] = (select auth.uid())::text
)
with check (
  bucket_id = 'user-packages'
  and (storage.foldername(name))[1] = 'staging'
  and (storage.foldername(name))[2] = (select auth.uid())::text
);
create policy "package_staging_delete_own" on storage.objects for delete to authenticated
using (
  bucket_id = 'user-packages'
  and (storage.foldername(name))[1] = 'staging'
  and (storage.foldername(name))[2] = (select auth.uid())::text
);
