# Bankr Space — auth model

## What Bankr terminal login vs app login means

| Layer | What it is |
|-------|------------|
| **bankr.bot session** | You're signed in as @handle with wallet `0x374d…` (or similar) |
| **App iframe session** | Separate SDK scope: `bankr.ctx.walletAddress` + `bankr.auth.isAuthenticated` |

Being logged into the Bankr terminal does **not** always populate the app iframe wallet on first paint. Public apps (`frontendIdentity: "viewer"`) often show spaces immediately while the wallet bar stays unlinked until `bankr.auth.requireSignIn()` runs.

This is **not** a bankr.space API issue — the API reads `x-wallet-address` from `apiWrite.ts`, which uses `ctx.caller.walletAddress` from the Bankr script runtime.

## What works without linking wallet in the app

- Browse all spaces
- Open a space and read posts
- See market stats, filters, search

## What requires wallet linked in the app

- Create Space
- Post / react
- Verify / pin (beneficiary only)
- Holder check banner on space detail

Inside a space, "view only" can also mean **you don't hold the token** — that's separate from the wallet bar.

## v19+ auto-link behavior

On boot the app:

1. Loads public data via `apiGet` (no wallet needed)
2. Probes `ctx.caller` / `bankr.wallet.me()` via `includeSession`
3. Calls `bankr.auth.requireSignIn()` once if still unlinked (no-op when terminal session exists)

Footer must show **`Bankr Space · v19`** to confirm this build is live on Bankr.

## If wallet bar still unlinked after v19

1. Click **link wallet** in the header bar
2. Hard refresh the app (Bankr header **Refresh**)
3. Re-deploy `apiGet.ts` + `index.html` from GitHub main

## Reply template for Bankr support

> Reading spaces is working as designed (public). The wallet bar shows "not linked" because the v2 app iframe isn't receiving `bankr.ctx.walletAddress` from the host on boot — v19 adds `requireSignIn()` + session probe to bridge terminal login to app scope. Footer still on v16 means the fix isn't deployed yet.
