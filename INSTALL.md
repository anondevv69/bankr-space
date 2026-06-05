# Install Bankr Communities on Bankr

Use this when asking the Bankr agent to install or reinstall the app from GitHub.

**Install path:** `apps/bankr-communities-v2/`  
**Slug:** `bankr-communities-v2`  
**Version:** `11` (footer must show `v11`)

The old slug `bankr-communities` has corrupted runtime storage — always install as **v2**.

---

## One-shot install prompt (paste into Bankr chat)

```text
Install my Bankr app from GitHub. Read the install manifest first:

https://raw.githubusercontent.com/anondevv69/bankr-community/main/apps/bankr-communities-v2/bankr-install.json

Then create a NEW app (do not update the broken bankr-communities app):
- slug: bankr-communities-v2
- title: Bankr Communities
- visibility: public

Fetch each file listed in bankr-install.json using http.fetch (NOT curl) from:
https://raw.githubusercontent.com/anondevv69/bankr-community/main/apps/bankr-communities-v2/

Write every file byte-for-byte. Do NOT merge, rewrite, or redesign the UI.

After install:
1. Dry-run syncTokens — must return ok:true, NOT "File not found"
2. Confirm footer says "rayblanco.eth · v11"
3. List all files written
```

---

## File list (raw GitHub URLs)

| File | URL |
|------|-----|
| Install manifest | https://raw.githubusercontent.com/anondevv69/bankr-community/main/apps/bankr-communities-v2/bankr-install.json |
| manifest.json | https://raw.githubusercontent.com/anondevv69/bankr-community/main/apps/bankr-communities-v2/manifest.json |
| index.html | https://raw.githubusercontent.com/anondevv69/bankr-community/main/apps/bankr-communities-v2/index.html |
| syncTokens.ts | https://raw.githubusercontent.com/anondevv69/bankr-community/main/apps/bankr-communities-v2/scripts/syncTokens.ts |
| searchTokens.ts | https://raw.githubusercontent.com/anondevv69/bankr-community/main/apps/bankr-communities-v2/scripts/searchTokens.ts |
| lookupLaunch.ts | https://raw.githubusercontent.com/anondevv69/bankr-community/main/apps/bankr-communities-v2/scripts/lookupLaunch.ts |
| resolveUserProfiles.ts | https://raw.githubusercontent.com/anondevv69/bankr-community/main/apps/bankr-communities-v2/scripts/resolveUserProfiles.ts |
| verifyHolder.ts | https://raw.githubusercontent.com/anondevv69/bankr-community/main/apps/bankr-communities-v2/scripts/verifyHolder.ts |
| createPost.ts | https://raw.githubusercontent.com/anondevv69/bankr-community/main/apps/bankr-communities-v2/scripts/createPost.ts |
| createCommunity.ts | https://raw.githubusercontent.com/anondevv69/bankr-community/main/apps/bankr-communities-v2/scripts/createCommunity.ts |
| verifyCommunity.ts | https://raw.githubusercontent.com/anondevv69/bankr-community/main/apps/bankr-communities-v2/scripts/verifyCommunity.ts |
| addReaction.ts | https://raw.githubusercontent.com/anondevv69/bankr-community/main/apps/bankr-communities-v2/scripts/addReaction.ts |

---

## Step-by-step (if one-shot hits step limit)

Send one prompt per step:

**Step 1 — Read install manifest**
```text
Fetch and read https://raw.githubusercontent.com/anondevv69/bankr-community/main/apps/bankr-communities-v2/bankr-install.json
Confirm slug bankr-communities-v2 and list all files to install.
```

**Step 2 — Create app + manifest**
```text
Create new Bankr app slug bankr-communities-v2. Write manifest.json from:
https://raw.githubusercontent.com/anondevv69/bankr-community/main/apps/bankr-communities-v2/manifest.json
```

**Step 3 — Write index.html**
```text
Write index.html for bankr-communities-v2 from:
https://raw.githubusercontent.com/anondevv69/bankr-community/main/apps/bankr-communities-v2/index.html
Footer must say v11. Do not modify content.
```

**Step 4 — Write scripts batch 1**
```text
Write these scripts for bankr-communities-v2 from raw.githubusercontent.com (apps/bankr-communities-v2/scripts/):
syncTokens.ts, searchTokens.ts, lookupLaunch.ts
```

**Step 5 — Write scripts batch 2**
```text
Write these scripts for bankr-communities-v2:
resolveUserProfiles.ts, verifyHolder.ts, createPost.ts
```

**Step 6 — Write scripts batch 3 + verify**
```text
Write these scripts for bankr-communities-v2:
createCommunity.ts, verifyCommunity.ts, addReaction.ts

Then dry-run syncTokens. Confirm ok:true and footer v11.
```

---

## Verify install worked

| Check | Expected |
|-------|----------|
| App slug | `bankr-communities-v2` |
| App panel | Loads (no "Failed to load app") |
| Footer | `made with love <3 rayblanco.eth · v11` |
| syncTokens dry-run | `{ "ok": true, ... }` |
| Other scripts dry-run | validation error like `tokenAddress required` — NOT File not found |

Then click **Refresh** on the app panel and run **syncTokens** once to populate token launches.
