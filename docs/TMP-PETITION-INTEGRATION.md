# TMP petition integration (Bankr Space)

bankr.space runs the **full petition UX** on-site. Token Marketplace (TMP) is the **backend engine** — escrow, unit counting, deploy, airdrop.

## Architecture

| Layer | Owner |
|-------|--------|
| UI (create, back, progress, posts) | bankr.space |
| Petition state, ETH escrow, launch | TMP API |
| Live token space after finalize | bankr.space `POST /api/communities/{token}` |

**Users never need to visit tokenmarketplace.shop** for the happy path.

## TMP API (production)

Base URL: `https://www.tokenmarketplace.shop/api/petition`

| Method | Path | Used by bankr.space |
|--------|------|---------------------|
| GET | `/config` | Pricing, goal units, Base enabled, TMK claim service |
| POST | `/create` | Create Space → Petition tab (`supporterSlots`, `maxUnitsPerWallet`, `tmkClaimOptIn`) |
| GET | `/status?id=` | Poll progress, backers, finalize |
| GET | `/prepare-deposit?id=&wallet=&units=` | Quote + ETH tx shape |
| POST | `/confirm` | After wallet sends ETH |
| POST | `/refund` | Back out — refund units while petition is open |
| GET | `https://www.tokenmarketplace.shop/api/holders/by-token?token=` | Live cap table after deploy |

CORS: `Access-Control-Allow-Origin: *` — browser calls work from bankr.space.

Deposits are **native ETH** to TMP escrow — **not** bankr.space x402 USDC.

## bankr.space routes

| Route | Purpose |
|-------|---------|
| `POST /api/petitions` | Create TMP petition + KV record |
| `GET /api/petitions` | List open petition spaces |
| `GET /api/petitions/[id]` | Merged Space + TMP status |
| `PATCH /api/petitions/[id]` | Founder edits description |
| `POST /api/petitions/[id]` | `prepare-deposit`, `confirm`, `refund`, `upgrade` |
| `GET /api/communities/[address]/holders` | Petition backers (pre-launch orders or live cap table) |
| `GET/POST /api/petitions/[id]/posts` | Pre-launch community posts |
| `GET /api/cron/petition-finalize` | Upgrade finalized petitions to token spaces |

Pages: `/community/petition/[id]`

Env: `TMP_PETITION_API_BASE`, `TMP_SITE_URL` (holders API; default production URL)

## Backing options (create)

- **Equal slots** — `supporterSlots: 50` → 50 backers × 20 units each (1000 total). With TMK claim, public cap is 999 — slots must divide evenly.
- **Max per wallet** — `maxUnitsPerWallet: 10` (1–1000). UI shows how many wallets can fill the cap at max.
- **TMK claim opt-in** — `tmkClaimOptIn: true` (Base only, when `config.base.tmkClaimService === true`). Reserves 1 unit for @TokenMkp; public cap becomes 999.

## Refund

While petition status is `open`, backers can **Back out / refund** via `POST /api/petitions/[id]` with `{ action: "refund", scope: "units" }` → TMP `POST /refund`.

## Live space after finalize

- **Petition** tag + auto **Verified** on token spaces from petitions
- **Founder** (starter wallet) keeps edit/post rights even though fee beneficiary is a contract
- **Backers panel** — `GET /api/communities/{token}/holders` (TMP cap table or petition orders)

## Flow

1. User: **Create Space → Petition (pre-launch)**
2. `POST /api/petitions` → TMP `POST /create` (`chain: base`, `starterWallet`, name, symbol)
3. Redirect `/community/petition/{id}`
4. Backers: **Back with ETH** → prepare-deposit → wallet tx → confirm
5. At 1000 units: TMP deploys token
6. Cron or founder visit: upgrade → `POST /api/communities/{tokenAddress}` → redirect live space

## What we need from TMP (optional improvements)

### Required today

Nothing blocking — public API + CORS is sufficient for v1.

### Nice to have (ask TMP team)

| Item | Why |
|------|-----|
| **`PATCH /api/petition/{id}`** with `websiteUrl` | After create we know Space URL `https://bankr.space/community/petition/{id}` — today create happens before id is known, so TMP alerts may link to TMP only |
| **`websiteUrl` on create** accepting `{id}` placeholder or **`externalSpaceId`** | Stable cross-link without PATCH |
| **Webhook `POST bankr.space/.../petition-finalized`** | Faster upgrade vs 5m cron + poll |
| **`spaceUrl` in `GET /status`** | Echo bankr.space link in TMP UI/bot replies |
| **Staging petition API** | QA without mainnet 1000-unit finalize |

### Do not need

- Redis / Upstash access
- `PETITION_ADMIN_SECRET` (unless Space proxies cancel)
- Solana petition endpoints (Bankr Space = Base only)
- x402 bridge

## Test (curl)

```bash
# Config
curl -s "https://www.tokenmarketplace.shop/api/petition/config" | jq '.config.base.enabled'

# Create (mirrors Space API body)
curl -s -X POST "https://www.bankr.space/api/petitions" \
  -H "x-wallet-address: 0xYOUR_WALLET" \
  -H "Content-Type: application/json" \
  -d '{"tokenName":"Space Test","tokenSymbol":"SPTST","description":"Integration test","maxUnitsPerWallet":10}'

# Status
curl -s "https://www.bankr.space/api/petitions/ID"

# Prepare + confirm via UI at https://www.bankr.space/community/petition/ID
```

## Share with TMP team (one paragraph)

> bankr.space embeds your petition API client-side and via `/api/petitions/*` proxies. Creates use `POST /create` with `starterWallet` = Space founder. All deposits use `prepare-deposit` + ETH + `confirm`. Please add **`PATCH` to set `websiteUrl`** to `https://bankr.space/community/petition/{id}` after create (or accept `externalSpaceId` on create) so X/Telegram alerts link to our page. Optional: finalize webhook to `https://www.bankr.space/api/petitions/{id}` (future).
