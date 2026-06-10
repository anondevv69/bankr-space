# Align bankr.space (Vercel) with Aeon

Set these on **Vercel** → bankr.space project → Environment Variables.

| Variable | Value | Notes |
|----------|-------|-------|
| `CRON_SECRET` | Same as Aeon GitHub secret | Protects `GET /api/agent/platform-spaces` |
| `PLATFORM_AGENT_WALLET` | Your **Base Account** address (see BASE-ACCOUNT-SETUP.md) | Must match Aeon secret |
| `NEXT_PUBLIC_PLATFORM_AGENT_UI` | `true` | Show opt-in panel after first successful worker run |

**Aeon repo:** [github.com/anondevv69/bankr-space-aeon](https://github.com/anondevv69/bankr-space-aeon)

**Still required on Aeon only:** `BANKR_LLM_KEY` — fund at [bankr.bot/llm](https://bankr.bot/llm)

After Vercel redeploy, test:

```bash
curl -sS "https://bankr.space/api/agent/platform-spaces" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```
