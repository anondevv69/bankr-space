# Bankr Space — x402 fundraising (Model B)

Optional USDC contributions toward DexScreener or custom goals. **Posts stay free.**

## Architecture

```text
Donor → bankr.space Contribute (POST …/fundraising/x402 proxy)
     → x402.bankr.bot/{wallet}/fund?token=0x…&campaign=dex-profile&amount=1
     → Bankr verifies USDC ($1/request) via EIP-3009 → runs fund handler → settles
     → fund handler returns 200 (no outbound fetch)
     → bankr.space proxy credits KV via applyFundraisingCredit()
     → progress bar updates on space page
```

There is **no** `/fund` route on bankr.space. The handler lives in `x402/fund/index.ts` and deploys to **Bankr x402 Cloud** (`bankr x402 deploy`).

**Important:** Do not use plain USDC `transfer()` to the beneficiary for fundraising — that bypasses x402 and will not appear in the x402 dashboard. Each Contribute click is one x402 request ($1 USDC).

USDC settles through Bankr x402 (facilitator → your configured pay-to wallet). Dashboard **Pay To** is your earnings wallet; MetaMask shows the x402 facilitator contract on signature — expected.

## Deploy the x402 handler

1. Install [Bankr CLI](https://docs.bankr.bot/) and `bankr login`
2. **`cd` to the repo root** — `bankr x402 deploy` looks for `./x402/` in the **current directory** (not `~/.bankr/`):

```bash
cd "/Volumes/X9 Pro 1/community"
```

If you don't have this repo, run `bankr x402 init` in an empty folder, then copy in `x402/fund/` and `x402/bankr.x402.json` from this project.

3. Set secrets:

```bash
bankr x402 env set SPACE_SITE_URL=https://www.bankr.space
bankr x402 env set X402_FUND_WEBHOOK_SECRET=$(openssl rand -hex 32)
```

Use the **same** `X402_FUND_WEBHOOK_SECRET` on Vercel. Note: do **not** use `BANKR_*` env names on x402 Cloud — that prefix is reserved by Bankr.

4. Deploy (must still be in repo root):

```bash
bankr x402 deploy
```

5. Copy the deployed URL (e.g. `https://x402.bankr.bot/0xYourWallet/fund`)

### One endpoint for all spaces

The wallet in the URL (`0x374d91a5...`) is the **Bankr wallet that owns the x402 service** (who ran `bankr x402 deploy`), not a per-token address. Every space shares this URL; the **token contract** is passed as a query param:

`.../fund?token=0xef703b8...&campaign=custom&amount=1`

`NEXT_PUBLIC_X402_FUND_URL` on Vercel is a **host/template**. Each space builds pay-to from the token **fee recipient** wallet (`…/{feeRecipient}/fund`) — never the deployer. The proxy adds `?token=` per space when someone contributes.

## Vercel env vars

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_X402_FUND_URL` | `https://x402.bankr.bot/0xYourWallet/fund` |
| `X402_FUND_WEBHOOK_SECRET` | Same secret as x402 handler |

Redeploy after setting.

## Test credit (dev)

```bash
curl -X POST "https://bankr.space/api/communities/0xTOKEN/fundraising/credit" \
  -H "Authorization: Bearer YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"campaignId":"dex-profile","amountUsd":10}'
```

## Campaigns (per space)

| id | Default goal | Default on |
|----|--------------|------------|
| `dex-profile` | $299 | no |
| `dex-boost` | $99 | no |
| `custom` | $500 | no |

Beneficiary toggles in **Edit profile → Fundraising campaigns** (off by default; widget hidden until at least one campaign is enabled and saved).

## @bankrbot (skill — future)

```text
@bankrbot fund $10 to Space space for Dex
@bankrbot tip $25 to PMFI space dex profile
```

Routes to the same x402 URL with resolved `token` + `campaign`.

## Notes

- Dex Enhanced Token Info is paid **to DexScreener** (~[$299](https://marketplace.dexscreener.com/product/token-info)) — no public auto-checkout API.
- Fundraising **reimburses / prepares** the beneficiary; export pack from verified space profile is a separate follow-up.
- See [Bankr x402 Cloud](https://docs.bankr.bot/x402-cloud/overview/) for pricing and dashboard.
