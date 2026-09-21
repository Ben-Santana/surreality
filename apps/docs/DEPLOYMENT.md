# Deploy the website on Vercel

Use `apps/docs` as the Root Directory, the Vite framework preset, `npm run build`
as the Build Command, and `dist` as the Output Directory. `/docs` has its own
generated HTML entry and retains the guide's hash navigation.

## Host installers separately

Installers are ignored release artifacts, not part of the repository or website
deployment. A clean build does not need the desktop app, local installers, or
Supabase credentials. Production builds exclude any existing `public/downloads`
directory. Both development and production use the hosted GitHub release assets.

The following assets are published at
https://github.com/Ben-Santana/surreality/releases/tag/v1.0.0-preview.1:

- `apps/desktop/release/Surreality-1.0.0-arm64.dmg`
- `apps/desktop/release/Surreality-Setup-1.0.0-x64.exe`
- `apps/desktop/release/surreality-1.0.0-1-x86_64.pkg.tar.zst`

The Mac asset is ad-hoc signed and unnotarized; Gatekeeper can still block it.

These URLs are built into the site, so no Vercel environment variables are
required. To override them after publishing a future release, copy each asset's
actual download URL into Vercel Project Settings → Environment Variables:

- `VITE_DOWNLOAD_MAC_URL`
- `VITE_DOWNLOAD_WINDOWS_URL`
- `VITE_DOWNLOAD_LINUX_URL`

Enable the variables for Production and Preview as needed, then redeploy. Vite
embeds them at build time. Use permanent public HTTPS asset URLs, not temporary
signed links, release-page URLs, or credentials. Empty overrides use the built-in
release URLs; malformed overrides fail the build.

Supabase Free's 50 MB per-file limit is smaller than either installer, so it is
not suitable for these assets without upgrading.
