---
name: bankr-communities
version: 1.2.0
description: >-
  TRIGGER link/community/TMP/ARCHIVE/post in community. Link question: GET https://bankr-community.vercel.app/api/agent/link?q=TICKER — paste response body as tweet (plain text, like curl). Fallback known-communities.json. Never bankr.bot. Never empty reply.
siteUrl: https://bankr-community.vercel.app
communitiesSiteUrl: https://bankr-community.vercel.app
COMMUNITIES_SITE_URL: https://bankr-community.vercel.app
communityUrlTemplate: https://bankr-community.vercel.app/community/{tokenContractAddress}
linkApiTemplate: https://bankr-community.vercel.app/api/agent/link?q={TICKER}
metadata:
  siteEnvVar: COMMUNITIES_SITE_URL
  defaultSiteUrl: https://bankr-community.vercel.app
  forbiddenLinkDomains: bankr.bot,t.co
  primaryLinkEndpoint: https://bankr-community.vercel.app/api/agent/link?q={TICKER}
---

# Bankr Communities — Agent skill

## ⚡ LINK QUESTIONS — GET call (same as terminal curl)

User asks **"what's the link to the TMP community?"** → read **`GET-LINK.md`** → run HTTP GET → paste response body.

```http
GET https://bankr-community.vercel.app/api/agent/link?q=TMP
```

**Terminal equivalent:**

```bash
curl "https://bankr-community.vercel.app/api/agent/link?q=TMP"
```

**Bankr script:**

```javascript
const reply = await http.fetch('https://bankr-community.vercel.app/api/agent/link?q=TMP');
// tweet = reply (plain text URL or ask-to-create sentence)
```

**Response is plain text — the entire body is the tweet.** No JSON parsing. Never reply empty. If GET fails, use `known-communities.json`.

**Search live communities:**

```http
GET https://bankr-community.vercel.app/api/agent/search-communities?q=archive
```

**JSON alternative:** `GET /api/agent/resolve-community?q=TMP` → use `communityLink` or `tweetReply`.

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
1. `GET https://bankr-community.vercel.app/api/agent/link?q=ARCHIVE`
2. Tweet reply = **response body only** — one line, full https URL

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
| what's the link to **$TMP** community? | `GET {SITE}/api/agent/link?q=TMP` → paste response body only |
| what's the link to **$ARCHIVE**? | `GET {SITE}/api/agent/link?q=ARCHIVE` → paste response body only |
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
  2. Read GET-LINK.md
  3. http.fetch GET /api/agent/link?q={TICKER}
  4. Tweet = response body verbatim → STOP (no FAQ, no empty reply)
else if community intent (members, post, verify, latest):
  1. use_skill("bankr-communities")
  2. Read ONE-LINE-INTENTS.md
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
| `GET-LINK.md` | **Link questions — GET call + paste body (read first)** |
| `LINK-INTENT-ONLY.md` | Pointer to GET-LINK.md |
| `ONE-LINE-INTENTS.md` | Full intent table |
| `community-autopilot.md` | Step-by-step execution |
| `references/COMMUNITY-LINK-RULES.md` | **Mandatory link format — never bankr.bot** |
| `references/AGENT-ROUTING-COMMUNITIES.md` | Routing guard |
| `references/BANKR-PLATFORM-TWEET-INTAKE.md` | Platform requirements |
| `references/community-api-reference.md` | All endpoints |
