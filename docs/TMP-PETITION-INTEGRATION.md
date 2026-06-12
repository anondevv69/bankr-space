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
| GET | `/config` | Pricing, goal units, Base enabled |
| POST | `/create` | Create Space → Petition tab |
| GET | `/status?id=` | Poll progress, backers, finalize |
| GET | `/prepare-deposit?id=&wallet=&units=` | Quote + ETH tx shape |
| POST | `/confirm` | After wallet sends ETH |

CORS: `Access-Control-Allow-Origin: *` — browser calls work from bankr.space.

Deposits are **native ETH** to TMP escrow — **not** bankr.space x402 USDC.

## bankr.space routes

| Route | Purpose |
|-------|---------|
| `POST /api/petitions` | Create TMP petition + KV record |
| `GET /api/petitions` | List open petition spaces |
| `GET /api/petitions/[id]` | Merged Space + TMP status |
| `PATCH /api/petitions/[id]` | Founder edits description |
| `POST /api/petitions/[id]` | `prepare-deposit`, `confirm`, `upgrade` |
| `GET/POST /api/petitions/[id]/posts` | Pre-launch community posts |
| `GET /api/cron/petition-finalize` | Upgrade finalized petitions to token spaces |

Pages: `/community/petition/[id]`

Env: `TMP_PETITION_API_BASE` (default: production URL above)

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
