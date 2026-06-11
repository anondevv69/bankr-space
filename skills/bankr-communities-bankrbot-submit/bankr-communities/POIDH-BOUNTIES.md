# POIDH open bounties on Bankr Space

Token holders create **crowdfunded outcome bounties** on **bankr.space** — funded in **ETH on Base** via POIDH (not x402, not USDC agent pool).

## User intents

| User says | Agent does |
|-----------|------------|
| create a bounty for **$SPACE** | Holder calls API below → bounty opens on-chain automatically |
| what's the **SPACE** bounty? | `GET …/poidh` → list title, pool, status |
| fund / add to bounty | User connects **MetaMask or Rabby on Base** on the Bounties tab → Add funds |
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

## Agent limitations

- Agents **cannot** sign POIDH txs (fund, claim, vote) — user needs **EOA wallet on Base** (MetaMask/Rabby).
- **Do not** send users to poidh.xyz to work — everything is on bankr.space Bounties tab.
- Optional reference: `View on poidh.xyz` link on each bounty card.

## Flow (human)

1. Holder creates bounty (API or Bounties tab UI)
2. Anyone adds ETH → **Add funds** (voting power = share of pool)
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
