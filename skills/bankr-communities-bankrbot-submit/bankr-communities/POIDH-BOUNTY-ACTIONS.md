# POIDH bounty actions — create, seed, list (tweet + terminal)

> **Mandatory for @bankrbot:** user says **add ETH**, **seed**, **fund bounty**, **create bounty**, **open bounty** → load `bankr-communities` → **read this file** → **HTTP GET/POST bankr.space** → reply with result + space URL.
>
> **Do NOT** say "I don't have a bounty-funding tool" or offer raw POIDH contract calls for **seed** — use **`POST …/poidh/seed`** below.

**Site:** `https://bankr.space`  
**Writes:** header **`x-wallet-address: {user's linked Bankr wallet}`** — the wallet that holds the token (or fee recipient).

**Not POIDH contract calls from the agent wallet for seed** — the **server issuer EOA** signs `joinOpenBounty` after your API call.

---

## Resolve token address first

```
GET https://bankr.space/api/agent/link?q=SPACE
→ response body is plain text URL; token address is the 0x… in the path

GET https://bankr.space/api/agent/briefing?symbol=SPACE
→ JSON: community.tokenAddress, communityLink
```

Known tickers in **`known-communities.json`** (TMP, ARCHIVE, PMFI, SPACE).

---

## List bounties (GET)

**User says:**
```text
@bankrbot what bounties are on $SPACE?
@bankrbot list $TMP open bounties
```

**Request:**
```http
GET https://bankr.space/api/communities/{tokenAddress}/poidh
```

**Response (JSON) — fields you need:**

| Field | Meaning |
|-------|---------|
| `bounties[]` | Each row: `id`, `title`, `status` (`live`/`pending`), `poidhBountyId`, `amountWei`, `onChainActive` |
| `bountiesTabUrl` | Link for user |
| `spinUp.message` | If pending open on-chain |

**Reply:** summarize live bounties (title, pool ETH if `amountWei`, on-chain id) + paste `bountiesTabUrl` or `communityLink` on its own line.

---

## Seed pool ETH — **add ETH to bounty** (POST) ← use for "add 0.01 ETH to…"

**User says:**
```text
@bankrbot add 0.01 ETH to the $SPACE Test bounty
@bankrbot seed 0.005 ETH to bounty "make a split" on $TMP
@bankrbot fund the $SPACE Test bounty with 0.01 ETH
```

**Meaning:** platform **issuer wallet** adds ETH to the POIDH pool (`joinOpenBounty`). Max **0.1 ETH** per request. User must **hold the token** (`canPost`).

**Steps (execute in order — do not skip HTTP):**

```
1. Parse ethAmount from user (e.g. 0.01). Default none — must be explicit.
2. Parse ticker ($SPACE) and optional bounty title ("Test bounty").
3. Resolve tokenAddress (briefing or link API).
4. GET /api/communities/{tokenAddress}/poidh
   → find bounty where status=live, title matches (case-insensitive substring)
   → if no match but one live bounty, use it; else ask which title
5. POST /api/communities/{tokenAddress}/poidh/seed
   Header: x-wallet-address: {linked}
   Body JSON (either):
     { "title": "Test bounty", "ethAmount": "0.01" }
     { "bountyId": 243, "ethAmount": "0.01" }
6. On success JSON:
   → reply: "Added {ethAmount} ETH to {title} (bounty #{bountyId}). Tx: {txHash}"
   → paste bountiesUrl or communityLink on its own line
7. On error → paste error message + Bounties tab link
```

**curl (terminal — same as agent should POST):**

```bash
TOKEN=0xef703b860a6d422fa00cc67bbbb2662297cb6ba3
WALLET=0xYOUR_LINKED_WALLET

curl -sS "https://bankr.space/api/communities/${TOKEN}/poidh"

curl -sS -X POST "https://bankr.space/api/communities/${TOKEN}/poidh/seed" \
  -H "x-wallet-address: ${WALLET}" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test bounty","ethAmount":"0.01"}'
```

**Success response example:**

```json
{
  "success": true,
  "txHash": "0x…",
  "bountyId": 243,
  "ethAmount": "0.01",
  "mode": "issuer_seed",
  "message": "Added 0.01 ETH to bounty #243…",
  "bountiesUrl": "https://www.bankr.space/community/0xef70…#bounties"
}
```

**Forbidden replies:**
- "I don't have a bounty-funding tool"
- "drop the contract address and I'll hit it directly" (for seed — use API above)
- Sending user to poidh.xyz to fund

---

## Create bounty (POST)

**User says:**
```text
@bankrbot create a bounty for $SPACE: Test task — proof tweet URL
```

```http
POST https://bankr.space/api/communities/{tokenAddress}/poidh/request
x-wallet-address: 0x…
Content-Type: application/json

{
  "title": "Short task name",
  "description": "Full instructions + proof requirement"
}
```

Issuer seeds **0.001 ETH** and opens on-chain. Reply with success message + space URL.

---

## User funds with own wallet (guide only — no POST)

When user wants **their** ETH in the pool (their voting power):

```
1. GET …/poidh → bounty title + link
2. Reply:
   Open Bounties tab → select bounty → Add funds → MetaMask or Rabby on Base → confirm.
   https://bankr.space/community/{tokenAddress}
```

**Do not** POST seed for this case unless user explicitly asks the **platform/agent to add** ETH.

---

## Finalize claim (POST propose — after user submitted claim on site)

```http
POST https://bankr.space/api/communities/{tokenAddress}/poidh/propose
x-wallet-address: 0x…
{ "bountyId": 243, "claimId": 1 }
```

Only **claim submitter's** linked wallet. Issuer accepts or starts vote.

---

## Submit claim / vote (browser only)

`createClaim`, `voteClaim` require user **EOA on bankr.space** — no agent API. Guide to Bounties tab.

---

## Error handling

| Code | Meaning |
|------|---------|
| 401 | Missing x-wallet-address |
| 403 | User doesn't hold token |
| 404 | Bounty not found / not live yet |
| 409 | Duplicate pending create (same title opening) |
| 503 | POIDH issuer not configured on server |

If bounty `status: pending` → tell user to wait ~1 min and retry seed, or refresh Bounties tab.
