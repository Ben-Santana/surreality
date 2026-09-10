create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.spaces (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) <= 80),
  document jsonb not null default '{"mappings":[],"surfaces":[]}'::jsonb,
  schema_version integer not null default 1 check (schema_version > 0),
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (owner_id, id)
);

create index spaces_owner_updated on public.spaces(owner_id, updated_at desc);

create table public.assets (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  file_name text not null check (char_length(file_name) <= 255),
  mime_type text not null check (char_length(mime_type) <= 120),
  byte_size bigint not null check (byte_size >= 0 and byte_size <= 52428800),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, sha256),
  unique (owner_id, storage_path)
);

create table public.packages (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  package_id text not null check (package_id ~ '^[a-z0-9]+([._-][a-z0-9]+)+$'),
  version text not null check (version ~ '^\d+\.\d+\.\d+([-+][0-9A-Za-z.-]+)?$'),
  manifest jsonb not null,
  storage_path text not null,
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  byte_size bigint not null check (byte_size >= 0 and byte_size <= 52428800),
  visibility text not null default 'private' check (visibility in ('private', 'public', 'unlisted')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, package_id, version, sha256),
  unique (owner_id, storage_path)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger spaces_updated_at before update on public.spaces
for each row execute function public.set_updated_at();
create trigger assets_updated_at before update on public.assets
for each row execute function public.set_updated_at();
create trigger packages_updated_at before update on public.packages
for each row execute function public.set_updated_at();

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles(id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger auth_user_created
after insert on auth.users
for each row execute function public.create_profile_for_new_user();

alter table public.profiles enable row level security;
alter table public.spaces enable row level security;
alter table public.assets enable row level security;
alter table public.packages enable row level security;

create policy "profiles_select_own" on public.profiles for select to authenticated
using ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles for update to authenticated
using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "spaces_select_own" on public.spaces for select to authenticated
using ((select auth.uid()) = owner_id);
create policy "spaces_insert_own" on public.spaces for insert to authenticated
with check ((select auth.uid()) = owner_id);
create policy "spaces_update_own" on public.spaces for update to authenticated
using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "spaces_delete_own" on public.spaces for delete to authenticated
using ((select auth.uid()) = owner_id);

create policy "assets_select_own" on public.assets for select to authenticated
using ((select auth.uid()) = owner_id);
create policy "assets_insert_own" on public.assets for insert to authenticated
with check ((select auth.uid()) = owner_id);
create policy "assets_update_own" on public.assets for update to authenticated
using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "assets_delete_own" on public.assets for delete to authenticated
using ((select auth.uid()) = owner_id);

create policy "packages_select_owned_or_public" on public.packages for select to authenticated
using ((select auth.uid()) = owner_id or visibility = 'public');
create policy "packages_insert_own" on public.packages for insert to authenticated
with check ((select auth.uid()) = owner_id and visibility = 'private' and published_at is null);
create policy "packages_update_own_private" on public.packages for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id and visibility = 'private' and published_at is null);
create policy "packages_delete_own_private" on public.packages for delete to authenticated
using ((select auth.uid()) = owner_id and visibility = 'private');

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'user-assets',
  'user-assets',
  false,
  52428800,
  array['image/avif','image/bmp','image/gif','image/jpeg','image/png','image/svg+xml','image/webp','video/mp4','video/webm','audio/mpeg','audio/ogg','audio/wav','application/octet-stream']
)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'user-packages',
  'user-packages',
  false,
  52428800,
  array['application/vnd.surreality.package+json','application/json','application/octet-stream']
)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "user_assets_select_own" on storage.objects for select to authenticated
using (bucket_id = 'user-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "user_assets_insert_own" on storage.objects for insert to authenticated
with check (bucket_id = 'user-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "user_assets_update_own" on storage.objects for update to authenticated
using (bucket_id = 'user-assets' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'user-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "user_assets_delete_own" on storage.objects for delete to authenticated
using (bucket_id = 'user-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "user_packages_select_own" on storage.objects for select to authenticated
using (bucket_id = 'user-packages' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "user_packages_insert_own" on storage.objects for insert to authenticated
with check (bucket_id = 'user-packages' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "user_packages_update_own" on storage.objects for update to authenticated
using (bucket_id = 'user-packages' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'user-packages' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "user_packages_delete_own" on storage.objects for delete to authenticated
using (bucket_id = 'user-packages' and (storage.foldername(name))[1] = (select auth.uid())::text);

revoke all on table public.profiles from anon;
revoke all on table public.spaces from anon;
revoke all on table public.assets from anon;
revoke all on table public.packages from anon;
