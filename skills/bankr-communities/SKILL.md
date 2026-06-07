---
name: bankr-communities
version: 1.0.2
description: Token-gated Bankr community reads and writes via the Vercel site API. Use when the user asks about community latest posts, member count, verify community, post or comment in a token community, create a community, list communities, or search Bankr tokens for communities.
siteUrl: https://bankr-community.vercel.app
communitiesSiteUrl: https://bankr-community.vercel.app
metadata:
  siteEnvVar: COMMUNITIES_SITE_URL
  defaultSiteUrl: https://bankr-community.vercel.app
---

# Bankr Communities — Agent skill

**Default site (use this unless `COMMUNITIES_SITE_URL` env is set):**

```text
https://bankr-community.vercel.app
```

All `{SITE}` references below = that URL (or env override).

**Install:**

```text
install Bankr Communities skill at https://github.com/anondevv69/bankr-community/tree/main/skills/bankr-communities
```

**Site API base:** `https://bankr-community.vercel.app` (override via `COMMUNITIES_SITE_URL` env if needed).  
**Public agent guide:** `https://bankr-community.vercel.app/agent.md`  
**Public reads** need no wallet. **Writes** use the user's **linked Bankr wallet** in header `x-wallet-address`.

---

## TRIGGER → action (no skill jargon required)

Users say natural language on **tweet** or **terminal**. Bankr must **`use_skill("bankr-communities")`** **before** generic tools.

| User says | Agent does |
|-----------|------------|
| what's the latest on **$TMP** community? | `GET {SITE}/api/agent/briefing?symbol=TMP` → plain English summary |
| how many members in **TMP** community? | briefing → `stats.memberCount` |
| show recent posts in **0x935e…** community | `GET {SITE}/api/communities/0x935e…` |
| **verify** the **TMP** community | linked wallet = owner? → `POST …/verify` |
| **post** in **TMP** community: hello holders | holder check → `POST …/posts` `{ content }` |
| **comment** on **$CTO** community | same as post |
| start a community for **$PEPE** | search token → `POST …/communities/{addr}` |
| list all communities | `GET {SITE}/api/communities` |
| search Bankr tokens **PEPE** | `GET {SITE}/api/tokens/search?q=PEPE` |
| do I hold **TMP**? can I post? | `GET {SITE}/api/holders/{token}?wallet={linked}` |
| react 👍 on post **post_123** in **0x…** | `POST {SITE}/api/posts/post_123/react` |

**Forbidden:** ask user for skill name · ask wallet if X↔Bankr linked · invent community data without API call.

---

## Mandatory routing guard

```
if message matches community / verify / post / comment / members / latest:
  1. use_skill("bankr-communities")
  2. Read ONE-LINE-INTENTS.md + references/AGENT-ROUTING-COMMUNITIES.md
  3. GET /api/agent/briefing or specific API — BEFORE replying
  4. For writes: inject linked wallet → x-wallet-address header
  5. Plain English reply with site link — no API jargon
```

**Tweet = DM** — same pipeline. Load skill on `@bankrbot` intake **before** tool selection.

---

## Write actions (linked wallet)

| Action | Requires |
|--------|----------|
| Create community | Signed-in user, token on Bankr launches |
| Post / comment | Holder (on-chain balance > 0) |
| React | Holder |
| Verify | Token owner (fee recipient or deployer) |

If holder check fails → say "you need to hold $SYMBOL to post" + full community URL.

---

## Twitter/X reply rules (MANDATORY)

X does **not** render markdown links. Every reply **must** include the raw `https://` URL from API `links.communityPage`.

**Required format:**

```text
$TMP community — ✓ verified · 1 member · 2 posts
latest: "hiii" by @you

https://bankr-community.vercel.app/community/0x935e13a28849095db45e63040f109c34b757aba3
```

**Rules:**
- Copy `links.communityPage` from briefing or post API response — never omit
- Put the full URL on its **own line** (X auto-linkifies it)
- Never end with "view community:" and nothing after it
- Never use only `[View community](url)` markdown — always include the bare URL too
- After posting, include the same community URL again

---

## Success reply templates

**Briefing:**

```text
$TMP community — ✓ Verified · 12 members · 34 posts
latest: "@rayblanco.eth shared launch update…"

https://bankr-community.vercel.app/community/0x935e13a28849095db45e63040f109c34b757aba3
```

**Post:**

```text
posted to $TMP holder community: "this is from X"

https://bankr-community.vercel.app/community/0x935e13a28849095db45e63040f109c34b757aba3
```

---

## Hub install stack (with TMP)

```text
install TMP site agent at https://github.com/anondevv69/bankr-tmp-skill/tree/main/tmp-site-agent
install TMP skills at https://github.com/anondevv69/bankr-tmp-skill
install Bankr Communities skill at https://github.com/anondevv69/bankr-community/tree/main/skills/bankr-communities
```

TMP marketplace ops → TMP skills. Community social layer → **this skill**.

---

## Files

| File | Purpose |
|------|---------|
| `ONE-LINE-INTENTS.md` | Full intent table |
| `community-autopilot.md` | Step-by-step execution |
| `references/AGENT-ROUTING-COMMUNITIES.md` | Routing guard |
| `references/BANKR-PLATFORM-TWEET-INTAKE.md` | Platform requirements |
| `references/community-api-reference.md` | All endpoints |
