# Install Bankr Communities v12 (embed shell)

v12 embeds **https://bankr-community.vercel.app** inside the Bankr app. Same UI, same Redis data, **Bankr sign-in** instead of WalletConnect.

**Only 2 files:** `manifest.json` + `index.html`  
**Slug:** `bankr-communities-v2` (update existing app — do not use broken `bankr-communities` slug)

---

## Option A — One message to Bankr (fastest)

Paste this in Bankr terminal:

```text
Update app bankr-communities-v2 to v12 embed shell:

1. Write manifest.json from:
https://raw.githubusercontent.com/anondevv69/bankr-community/main/apps/bankr-communities-v2/manifest.json

2. Write index.html from:
https://raw.githubusercontent.com/anondevv69/bankr-community/main/apps/bankr-communities-v2/index.html

Do not modify content. Confirm manifest version is "12" and footer says "rayblanco.eth · v12".
Remove old scheduled scripts if any — v12 needs no backend scripts.
Make the app public.
```

---

## Option B — Piece by piece (3 steps)

### Step 1 — manifest.json

```text
For app bankr-communities-v2, write ONLY manifest.json using http.fetch from:

https://raw.githubusercontent.com/anondevv69/bankr-community/main/apps/bankr-communities-v2/manifest.json

Confirm version is "12" and scripts array is empty.
```

### Step 2 — index.html

```text
For app bankr-communities-v2, write ONLY index.html using http.fetch from:

https://raw.githubusercontent.com/anondevv69/bankr-community/main/apps/bankr-communities-v2/index.html

Do not redesign. Confirm iframe src uses bankr-community.vercel.app?embed=bankr
and footer contains "rayblanco.eth · v12".
```

### Step 3 — Verify

```text
For app bankr-communities-v2:
1. List files — should be manifest.json + index.html (+ optional legacy scripts you can ignore)
2. Open the app — should load the full Vercel communities site inside the panel
3. Sign in with Bankr — header should show "Signed in via Bankr · 0x…"
4. Confirm footer says "rayblanco.eth · v12"
5. Make app public
```

---

## After install — user flow

1. Open **Bankr terminal** → **Apps** → **Bankr Communities** (`bankr-communities-v2`)
2. App loads the same UI as https://bankr-community.vercel.app
3. Click **Sign in with Bankr** (or you're already signed in)
4. Post, verify, pin, edit profile — all hit Vercel API with your Bankr wallet

**Deep link to a community** (optional hash routing):

```text
#/community/0x935e13a28849095db45e63040f109c34b757aba3
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| CSP `frame-ancestors` / "refused to connect" | Vercel must **not** send `frame-ancestors` — Bankr apps run in a null-origin sandbox, which `*` does not match. Fixed in web v2.1+. Redeploy Vercel, hard-refresh app. |
| Blank iframe | Wait for Vercel deploy. Re-install index.html from GitHub. |
| "Sign in with Bankr" does nothing | Sign into Bankr terminal first, then Refresh in app header. |
| Old UI / missing market stats | Still on v11 — reinstall v12 index.html. |
| Embed still blocked | Use **Open bankr-community.vercel.app** button in app (opens new tab). |

---

## Architecture

```
Bankr terminal
└── bankr-communities-v2/index.html  (wallet bridge)
    └── iframe → bankr-community.vercel.app?embed=bankr
         └── Next.js app (communities, posts, market stats, profile, pin)
```

Wallet bridge: parent posts `{ type: "BANKR_WALLET", address, authenticated }` → Vercel uses it for API writes.
