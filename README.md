# Bankr Communities

A native [Bankr app](https://docs.bankr.bot/apps/overview/) for token-gated community discussions around Bankr-deployed tokens.

## How it works

1. **Find Token** — Search all Bankr deployments by name, symbol, or contract address.
2. **Find Token** — Live search via Bankr API (`/tokens/search` + `/token-launches/:address`). Finds any Bankr-deployed token, not just the 50 most recent.
3. **Start Community** — Anyone signed in can start a community for any Bankr token.
4. **Owner Verification** — The token owner (fee recipient or deployer) verifies the community as official. If the owner starts it themselves, it's auto-verified.
5. **View** — Anyone can browse communities and read posts.
6. **Post & React** — Only token holders can post and react (verified server-side via `bankr.wallet.balances()`).

## Deploy to Bankr

1. Ask Bankr to install this app, or copy the `apps/bankr-communities/` folder into your Bankr file storage at `/apps/bankr-communities/`.
2. Run the **syncTokens** script once from the Scripts drawer to populate token launches.
3. Open the app — fee recipients will see a **Create Community** button on their tokens.
4. Make the app public when ready: `make this app public`

## File structure

```
apps/bankr-communities/
├── manifest.json          # Permissions, schedule, public data keys
├── index.html             # Frontend UI (runs in Bankr iframe)
└── scripts/
    ├── syncTokens.ts      # Hourly fetch of 50 recent launches
    ├── searchTokens.ts    # Live API search by name/symbol/address
    ├── lookupLaunch.ts    # Lookup single token launch by address
    ├── createCommunity.ts # Anyone can start; owner auto-verified if creator
    ├── verifyCommunity.ts # Token owner verifies community as official
    ├── verifyHolder.ts    # Check if viewer holds the token
    ├── createPost.ts      # Token-gated posting
    └── addReaction.ts     # Token-gated reactions
```

## Permissions

| Permission | Purpose |
|---|---|
| `read:wallet` | Identify the connected wallet |
| `read:portfolio` | Verify token holdings for gating |
| `read:appdata` / `write:appdata` | Community and post storage |
| `fetch:http` | Pull token launches from Bankr API |

`frontendIdentity` is set to `"viewer"` so holder checks run against each visitor's wallet, not the app owner's.

## Push to GitHub

```bash
git init
git add .
git commit -m "Add Bankr Communities native app"
git remote add origin https://github.com/anondevv69/bankr-community.git
git push -u origin main
```

## Docs

- [Apps Overview](https://docs.bankr.bot/apps/overview/)
- [Permissions](https://docs.bankr.bot/apps/permissions/)
- [SDK Reference](https://docs.bankr.bot/apps/sdk/)
- [List Token Launches API](https://docs.bankr.bot/token-launching/api-reference/list-token-launches/)
