<p align="center">
  <img src="assets/logo.png" alt="Bankr Communities logo" width="160" />
</p>

# Bankr Communities

A native [Bankr app](https://docs.bankr.bot/apps/overview/) for token-gated community discussions around Bankr-deployed tokens.

## How it works

1. **Communities** — Browse active token communities on the home page.
2. **Create Community** — Search any Bankr token by name, symbol, or contract address, then start a community.
3. **Owner Verification** — The token owner verifies the community as official (auto-verified if the owner creates it).
4. **View** — Anyone can browse communities and read posts.
5. **Post & React** — Only token holders can post and react.

## Deploy to Bankr

The Bankr native app lives in `apps/bankr-communities-v2/`. See [INSTALL.md](./INSTALL.md).

## Deploy as a website (Vercel)

**Recommended** if Bankr app storage is broken. Full Next.js app in `web/`:

→ **[web/DEPLOY.md](./web/DEPLOY.md)** — step-by-step Vercel setup

Quick summary:
1. Import repo on Vercel with **Root Directory: `web`**
2. Add **Vercel KV** storage
3. Set `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` and `CRON_SECRET`
4. Deploy

## File structure

```
apps/bankr-communities-v2/     ← install this (canonical)
├── bankr-install.json         ← install manifest for Bankr agent
├── manifest.json
├── index.html
└── scripts/
    ├── syncTokens.ts
    ├── searchTokens.ts
    ├── lookupLaunch.ts
    ├── resolveUserProfiles.ts
    ├── verifyHolder.ts
    ├── createPost.ts
    ├── createCommunity.ts
    ├── verifyCommunity.ts
    └── addReaction.ts

apps/bankr-communities/        ← legacy slug (deprecated if storage corrupted)
```

## Permissions

| Permission | Purpose |
|---|---|
| `read:wallet` | Identify the connected wallet |
| `read:portfolio` | Verify token holdings for gating |
| `read:chain` | On-chain balanceOf fallback for holder checks |
| `read:appdata` / `write:appdata` | Community and post storage |
| `fetch:http` | Pull token launches from Bankr API |

`frontendIdentity` is set to `"viewer"` so holder checks run against each visitor's wallet, not the app owner's.

## Docs

- [Apps Overview](https://docs.bankr.bot/apps/overview/)
- [Permissions](https://docs.bankr.bot/apps/permissions/)
- [SDK Reference](https://docs.bankr.bot/apps/sdk/)
- [List Token Launches API](https://docs.bankr.bot/token-launching/api-reference/list-token-launches/)
