---
name: bankr-communities
version: 1.1.1
description: >-
  Bankr token communities on https://bankr-community.vercel.app. Link flow: GET /api/agent/resolve-community?q=TICKER — if community exists paste communityLink; if token found but no community ask user to create one. Never bankr.bot.
siteUrl: https://bankr-community.vercel.app
communitiesSiteUrl: https://bankr-community.vercel.app
COMMUNITIES_SITE_URL: https://bankr-community.vercel.app
communityUrlTemplate: https://bankr-community.vercel.app/community/{tokenContractAddress}
metadata:
  siteEnvVar: COMMUNITIES_SITE_URL
  defaultSiteUrl: https://bankr-community.vercel.app
  forbiddenLinkDomains: bankr.bot,t.co
---

# Bankr Communities — Agent skill

## ⚡ LINK & SEARCH — DO THIS FIRST

User asks for **link**, **URL**, or **community page** for a ticker/token → read **`LINK-INTENT-ONLY.md`**.

**Primary API (search + link in one call):**

```http
GET https://bankr-community.vercel.app/api/agent/resolve-community?q=TMP
```

**Flow:** search existing communities → if found paste `communityLink` → if not, find Bankr token → if token exists but no community, paste `tweetReply` asking if they want to create one → on yes, `POST /api/communities/{tokenAddress}` then share link.

**Search live communities only:**

```http
GET https://bankr-community.vercel.app/api/agent/search-communities?q=archive
```

**Tweet reply = `communityLink` or `tweetReply` from JSON — one line. Never bankr.bot.**

---
## LINK RULES (mandatory for every community reply)

```text
https://bankr-community.vercel.app/community/{tokenContractAddress}
```

| Token | Link |
|-------|------|
| $TMP | `https://bankr-community.vercel.app/community/0x935e13a28849095db45e63040f109c34b757aba3` |
| $ARCHIVE | `https://bankr-community.vercel.app/community/0x76aba8089e4ba07f705fb886d17dd41793ad2ba3` |

**FORBIDDEN:** `bankr.bot`, `t.co`, `/community/TMP`, `/community/ARCHIVE`, or any URL not on `bankr-community.vercel.app/community/0x…`

**Link questions** ("what's the link", "community URL"):
1. `GET https://bankr-community.vercel.app/api/agent/community-link?symbol=ARCHIVE`
2. Tweet reply = **only** the `communityLink` value — one line, full https URL

**Never invent links. Never substitute bankr.bot.** Read `references/COMMUNITY-LINK-RULES.md`.

All `{SITE}` references below = `https://bankr-community.vercel.app`.

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
| what's the link to **$TMP** community? | `GET {SITE}/api/agent/resolve-community?q=TMP` → paste `communityLink` only |
| what's the link to **$ARCHIVE**? | `GET {SITE}/api/agent/resolve-community?q=ARCHIVE` → paste `communityLink` |
| search communities **archive** | `GET {SITE}/api/agent/search-communities?q=archive` |
| what's the latest on **$TMP** community? | `GET {SITE}/api/agent/briefing?symbol=TMP` → paste full `replyText` (URL is line 2) |
| how many members in **TMP** community? | briefing → `stats.memberCount` |
| show recent posts in **0x935e…** community | `GET {SITE}/api/communities/0x935e…` |
| **verify** the **TMP** community | linked wallet = owner? → `POST …/verify` |
| **post** in **TMP** community: hello holders | holder check → `POST …/posts` → paste `replyText` from response |
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
if message contains "link" OR "url" OR "where is" + community/token:
  1. use_skill("bankr-communities")
  2. Read LINK-INTENT-ONLY.md FIRST
  3. GET /api/agent/resolve-community?q=… (link) OR search-communities (list) OR briefing (stats)
  4. Link questions → paste communityLink only → STOP (no FAQ)
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
| Post / comment | **Holder** OR **fee recipient** OR **deployer** (owner can post without holding) |
| React | Holder OR fee recipient OR deployer |
| Verify | Token owner (fee recipient or deployer) |

`GET /api/holders/{token}?wallet=` returns `canPost: true` for holders **and** owners.

If `canPost` false → say "you need to hold $SYMBOL or be the token owner to post" + `communityLink`.

**Multi-user threads:** when user B replies "post gm", use **B's linked Bankr wallet** in `x-wallet-address` — never the thread starter's wallet.

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
| `LINK-INTENT-ONLY.md` | **Link questions — highest priority, read first** |
| `ONE-LINE-INTENTS.md` | Full intent table |
| `community-autopilot.md` | Step-by-step execution |
| `references/COMMUNITY-LINK-RULES.md` | **Mandatory link format — never bankr.bot** |
| `references/AGENT-ROUTING-COMMUNITIES.md` | Routing guard |
| `references/BANKR-PLATFORM-TWEET-INTAKE.md` | Platform requirements |
| `references/community-api-reference.md` | All endpoints |
