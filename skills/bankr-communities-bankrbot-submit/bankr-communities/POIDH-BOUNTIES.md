# POIDH open bounties on Bankr Space

Token holders create **crowdfunded outcome bounties** on **bankr.space** — funded in **ETH on Base** via POIDH (not x402, not USDC agent pool).

> **@bankrbot execute create / seed / list:** read **`POIDH-BOUNTY-ACTIONS.md`** first — step-by-step GET/POST, curl, response fields, forbidden replies.

## User intents

| User says | Agent does |
|-----------|------------|
| create a bounty for **$SPACE** | **`POIDH-BOUNTY-ACTIONS.md`** → `POST …/poidh/request` |
| **add** / **seed** ETH to bounty | **`POIDH-BOUNTY-ACTIONS.md`** → `GET …/poidh` → **`POST …/poidh/seed`** |
| what's the **SPACE** bounty? | **`POIDH-BOUNTY-ACTIONS.md`** → `GET …/poidh` |
| fund bounty (user's wallet) | Guide to Bounties tab + MetaMask (see actions doc) |
| submit proof / claim | User on Bounties tab — EOA required |
| vote on bounty claim | User on Bounties tab — EOA required |

## Funding (two paths)

See **`POIDH-BOUNTY-ACTIONS.md`** for full execution. Summary:

### A — User adds their own ETH (voting power = their share)

Guide to Bounties tab + MetaMask/Rabby on Base.

### B — Platform issuer seeds more ETH (**agent executes POST seed**)

```http
POST https://bankr.space/api/communities/{tokenAddress}/poidh/seed
x-wallet-address: 0x…
Content-Type: application/json

{ "title": "Test bounty", "ethAmount": "0.01" }
```

Cap: **0.1 ETH** per request. Example tweet: `@bankrbot add 0.01 ETH to the $SPACE Test bounty`

**Agent must NOT** say it lacks a funding tool — this endpoint is the tool.

---

## Create bounty (token holder)

Details in **`POIDH-BOUNTY-ACTIONS.md`**. Quick reference:

```http
POST https://bankr.space/api/communities/{tokenAddress}/poidh/request
x-wallet-address: 0x…
Content-Type: application/json

{ "title": "Task name", "description": "Instructions + proof requirement" }
```

## List bounties

```http
GET https://bankr.space/api/communities/{tokenAddress}/poidh
```

## Agent limitations

- Agents **cannot** sign POIDH txs with the **user's** wallet (fund, claim, vote) — user needs **EOA on Base** (MetaMask/Rabby) on bankr.space.
- Agents **can** seed pool ETH via **`POST …/poidh/seed`** (issuer wallet, max 0.1 ETH/request).
- **Do not** send users to poidh.xyz to work — everything is on bankr.space Bounties tab.
- Optional reference: `View on poidh.xyz` link on each bounty card.

## Flow (human)

1. Holder creates bounty (API or Bounties tab UI)
2. Anyone adds ETH → **Add funds** (voting power = share of pool) — or holder asks agent to **seed**
3. Worker completes task → **Submit claim** + proof URL
4. Claim submitter clicks **Accept & pay** (issuer-only pool) or **Request vote** (multiple funders) → 48h vote only when needed
5. Funders **Vote yes/no** on bankr.space
6. After deadline → **Resolve vote** → winner withdraws ETH

## Briefing

```http
GET https://bankr.space/api/agent/briefing?token=0x…
```

Check space page Bounties tab; `poidhBounties` in community JSON when enabled.

## Links

- Space bounties: `https://bankr.space/community/{tokenAddress}` → **Bounties** tab
- POIDH guide: https://words.poidh.xyz/poidh-open-bounties-guide
