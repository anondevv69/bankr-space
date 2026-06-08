# Install Bankr Space v14 (native UI + Vercel API)

v14 matches the **bankr.space** web UI: logo, Create Space modal, verified filters, hero market stats, post filters, and light/dark theme. All data comes from **https://bankr.space** via `apiGet` / `apiWrite` scripts.

**Files to install:** `manifest.json`, `index.html`, `scripts/apiGet.ts`, `scripts/apiWrite.ts`  
**Slug:** `bankr-communities-v2`

---

## One-shot install (paste in Bankr terminal)

```text
Update app bankr-communities-v2 to v14:

1. Write manifest.json from:
https://raw.githubusercontent.com/anondevv69/bankr-community/main/apps/bankr-communities-v2/manifest.json

2. Write index.html from:
https://raw.githubusercontent.com/anondevv69/bankr-community/main/apps/bankr-communities-v2/index.html

3. Write scripts/apiGet.ts from:
https://raw.githubusercontent.com/anondevv69/bankr-community/main/apps/bankr-communities-v2/scripts/apiGet.ts

4. Write scripts/apiWrite.ts from:
https://raw.githubusercontent.com/anondevv69/bankr-community/main/apps/bankr-communities-v2/scripts/apiWrite.ts

Do not modify content. Confirm manifest version is "14" and footer says "rayblanco.eth · v14".
Disable old syncTokens schedule — v14 needs no cron scripts.
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
    → http.fetch('https://bankr.space/api/...')
      → Vercel Redis (same data as public site)
```

Writes pass `x-wallet-address` from `ctx.caller.walletAddress` (your Bankr wallet).
