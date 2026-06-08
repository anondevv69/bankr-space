# Install Bankr Space v13 (native UI + Vercel API)

v13 uses a **native Bankr HTML app** (no iframe). All data comes from **https://bankr-community.vercel.app** via `apiGet` / `apiWrite` scripts. Bankr wallet sign-in works without WalletConnect or localStorage.

**Files to install:** `manifest.json`, `index.html`, `scripts/apiGet.ts`, `scripts/apiWrite.ts`  
**Slug:** `bankr-communities-v2`

---

## Why not iframe? (v12)

Bankr apps run in a sandbox **without `allow-same-origin`**. The Vercel Next.js app needs localStorage/cookies (wagmi) and crashes with a black screen. v13 avoids that entirely.

---

## One-shot install (paste in Bankr terminal)

```text
Update app bankr-communities-v2 to v13:

1. Write manifest.json from:
https://raw.githubusercontent.com/anondevv69/bankr-community/main/apps/bankr-communities-v2/manifest.json

2. Write index.html from:
https://raw.githubusercontent.com/anondevv69/bankr-community/main/apps/bankr-communities-v2/index.html

3. Write scripts/apiGet.ts from:
https://raw.githubusercontent.com/anondevv69/bankr-community/main/apps/bankr-communities-v2/scripts/apiGet.ts

4. Write scripts/apiWrite.ts from:
https://raw.githubusercontent.com/anondevv69/bankr-community/main/apps/bankr-communities-v2/scripts/apiWrite.ts

Do not modify content. Confirm manifest version is "13" and footer says "rayblanco.eth · v13".
Disable old syncTokens schedule — v13 needs no cron scripts.
Make the app public.
```

---

## Verify

1. Open **Apps → Bankr Space**
2. Footer: `rayblanco.eth · v13 · Vercel API`
3. Spaces list loads (not black screen)
4. Open TMP space → market stats, posts visible
5. Sign in → post / verify / pin work

**Dry-run test:**
```text
Run script apiGet with args { "path": "/api/communities" }
```
Should return `{ ok: true, data: { communities: [...] } }`

---

## Features in Bankr app (v13)

| Feature | In app | Full site only |
|---------|--------|----------------|
| Browse spaces | ✓ | |
| Market stats + Dex paid | ✓ | |
| Posts + reactions | ✓ | |
| Verify space | ✓ | |
| Create space | ✓ | |
| Pin / unpin | ✓ | |
| Edit profile / socials | | ✓ (use "Open full site") |

---

## Architecture

```
Bankr app (native HTML)
  → bankr.scripts.run('apiGet' | 'apiWrite')
    → http.fetch('https://bankr-community.vercel.app/api/...')
      → Vercel Redis (same data as public site)
```

Writes pass `x-wallet-address` from `ctx.caller.walletAddress` (your Bankr wallet).
