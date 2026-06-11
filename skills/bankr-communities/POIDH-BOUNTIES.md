# POIDH open bounties on Bankr Space

Token holders create **crowdfunded outcome bounties** on **bankr.space** — funded in **ETH on Base** via POIDH (not x402, not USDC agent pool).

## User intents

| User says | Agent does |
|-----------|------------|
| create a bounty for **$SPACE** | Holder calls API below → bounty opens on-chain automatically |
| what's the **SPACE** bounty? | `GET …/poidh` → list title, pool, status |
| fund / add ETH to bounty | See **Funding** below — user EOA vs issuer seed |
| submit proof / claim | User submits claim on Bounties tab with proof URL (tweet, image link, etc.) |
| vote on bounty claim | Funders vote yes/no on bankr.space during 48h vote (weighted by ETH contributed) |

## Create bounty (token holder)

Requires linked wallet that **holds the token** (`canPost`).

```http
POST https://bankr.space/api/communities/{tokenAddress}/poidh/request
x-wallet-address: 0x…
Content-Type: application/json

{
  "title": "Share $SPACE on X with screenshot",
  "description": "Post on X mentioning $SPACE with a screenshot. Proof: tweet URL."
}
```

Response: bounty saved; platform issuer wallet seeds **0.001 ETH** and opens POIDH open bounty on Base (~1 min).

## List bounties

```http
GET https://bankr.space/api/communities/{tokenAddress}/poidh
```

Response includes `bounties[]` (title, `poidhBountyId`, `amountWei`, status) and `bountiesTabUrl`.

## Funding (two paths)

POIDH **`joinOpenBounty`** requires an **EOA** wallet (`tx.origin`). The user's linked Bankr smart wallet **cannot** fund directly.

### A — User adds their own ETH (voting power = their share)

1. `GET …/poidh` → find bounty title + `poidhBountyId`
2. Reply with steps + link:

```text
Open your space Bounties tab → select the bounty → Add funds → connect MetaMask or Rabby on Base → confirm.

https://bankr.space/community/{tokenAddress}
```

Example tweet: `@bankrbot how do I fund the $SPACE Test bounty?`

### B — Platform issuer seeds more ETH (agent CAN do this)

Holder asks to add pool ETH from the **platform issuer wallet** (not the user's wallet — issuer gets voting weight).

```http
POST https://bankr.space/api/communities/{tokenAddress}/poidh/seed
x-wallet-address: 0x…
Content-Type: application/json

{
  "bountyId": 243,
  "ethAmount": "0.01"
}
```

Or match by title:

```json
{ "title": "Test bounty", "ethAmount": "0.01" }
```

Cap: **0.1 ETH** per request. Requires `canPost` + live on-chain bounty.

Example tweets:

```text
@bankrbot add 0.01 ETH to the $SPACE Test bounty
@bankrbot seed 0.005 ETH to bounty "make a split" on $TMP
```

After seed, reply with tx hash + Bounties tab URL.

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
