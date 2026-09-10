# Supabase setup for the Surreality community library

Surreality stores rooms and imported media only on the local computer. Supabase provides accounts, public package metadata, private `.surreality` archive storage, download history, and moderation.

Never put a secret or `service_role` key in `apps/desktop/.env.local`. Edge Functions receive their service credentials from Supabase; the desktop app uses only the project URL and publishable key.

## 1. Confirm the retired cloud-sync tables are empty

The community migration deliberately stops if it would discard old cloud data. In **Supabase → SQL Editor**, run:

```sql
select
  (select count(*) from public.spaces) as spaces,
  (select count(*) from public.assets) as assets,
  (select count(*) from public.packages) as packages,
  (select count(*) from storage.objects where bucket_id in ('user-assets', 'user-packages')) as stored_objects;
```

All four values must be `0`. If they are not, export anything you need and remove those cloud rows/objects before continuing. This check does not inspect or change local rooms. The now-unused private `user-assets` bucket may remain in Storage; the migration removes its access policies without deleting the protected Storage record directly.

## 2. Link the Supabase CLI

From `apps/desktop`:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
```

`YOUR_PROJECT_REF` is the subdomain in `https://YOUR_PROJECT_REF.supabase.co`.

If you installed the first migration by pasting it into the SQL Editor, mark it as already applied before pushing:

```bash
npx supabase migration repair --status applied 20260830000000
npx supabase db push
```

If `db push` says the legacy-data safety check failed, return to step 1. Do not edit the migration to bypass the check.

## 3. Deploy the package service

From `apps/desktop`:

```bash
npx supabase functions deploy finalize-package-upload
npx supabase functions deploy package-download --no-verify-jwt
npx supabase functions deploy moderate-package
npx supabase functions deploy report-package
npx supabase functions deploy update-release-listing
npx supabase functions deploy update-release-thumbnail
npx supabase functions deploy save-package
```

`package-download` performs its own optional-user validation so signed-out users can install published packages. The other functions require a valid signed-in session.

## 4. Configure desktop public credentials

Open **Supabase → Connect** or **Project Settings → API Keys** and copy the Project URL and publishable key. Create `apps/desktop/.env.local`:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
```

Keep email/password authentication enabled. For password recovery inside the desktop app, make the recovery email template display `{{ .Token }}` as a six-digit code.

## 5. Create and designate the administrator

Run the desktop app, create your account, confirm its email, and sign in:

```bash
npm run dev
```

In Supabase, open **Authentication → Users** and copy your account UUID. In the SQL Editor run, substituting that UUID:

```sql
insert into public.app_admins(user_id)
values ('YOUR-AUTH-USER-UUID')
on conflict (user_id) do nothing;
```

Restart or sign out/in, open the account panel, and choose a public username. The **Moderation** tab will then appear. Email addresses are never exposed in the public catalog.

## 6. Verify the installation

From `apps/desktop`:

```bash
npm run check:supabase
```

The checker verifies public catalog access, private download history and Storage, anonymous package-download access, and authentication on upload/moderation functions.

Then test the complete flow:

1. Upload a sandboxed `.surreality` package from **Uploaded**; it should publish immediately.
2. Sign out, open **Discover**, and install it; the install works but is not added to account history.
3. Sign in and install it again; it appears under **Downloaded**.
4. Upload a package with a native plugin and `system:unrestricted`; it should remain `pending review`.
5. Approve it under **Moderation**, then confirm its native-code warning still appears during installation.
6. Take down a release and confirm it disappears from Discover and cannot issue a new download URL.

## Operational notes

- Published versions are immutable. Fixes require a new semantic version.
- Package IDs are globally claimed by their first publisher.
- Takedown is reversible and does not uninstall existing local copies.
- Signed download links expire after 60 seconds.
- Storage is limited to 50 MB per archive; the validator also caps expanded content at 50 MB and 512 files.
- Before a public launch, configure custom SMTP, Supabase billing/usage alerts, database backups, and Edge Function log monitoring.
