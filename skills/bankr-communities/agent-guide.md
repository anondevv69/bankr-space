# Bankr Communities — agent guide

**Human site:** `{COMMUNITIES_SITE_URL}` (Vercel Next.js app in `web/`)

**Bankr:** install skill from `skills/bankr-communities/` — agents call the **same HTTP API** as the website.

---

## Golden rules

1. **One sentence → full flow** — no "open the website" if API works.
2. **Briefing first** — `GET /api/agent/briefing` for "latest / members / opportunities".
3. **Holder-gated posts** — always `GET /api/holders/{token}?wallet=` before post/react.
4. **Owner verify** — only fee recipient / deployer.
5. **Reply with links** — full community URL, not "check the app".

---

## Intent → API

| User says | First call |
|-----------|------------|
| Latest on $TMP | `/api/agent/briefing?symbol=TMP` |
| Member count | briefing → stats.memberCount |
| Post in community | holders check → POST posts |
| Verify community | POST verify |
| Create community | search → POST communities |
| List all | GET /api/communities |

Full table: **`ONE-LINE-INTENTS.md`**

---

## Install with TMP stack

```text
install TMP site agent at https://github.com/anondevv69/bankr-tmp-skill/tree/main/tmp-site-agent
install TMP skills at https://github.com/anondevv69/bankr-tmp-skill
install Bankr Communities skill at https://github.com/anondevv69/bankr-community/tree/main/skills/bankr-communities
```

Set `COMMUNITIES_SITE_URL` on Bankr to your Vercel deployment URL.

---

## Execution

Step-by-step: **`community-autopilot.md`**  
Routing guard: **`references/AGENT-ROUTING-COMMUNITIES.md`**  
Tweet intake: **`references/BANKR-PLATFORM-TWEET-INTAKE.md`**
