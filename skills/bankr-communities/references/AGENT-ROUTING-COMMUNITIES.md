# Agent routing — Bankr Communities

> Load with skill install. Overrides generic "I don't know about communities" replies.

## TRIGGER

**Match:** community, members, posts, verify community, post in, comment in, latest on $TICKER community, start community.

**Load:** `bankr-communities` → **`references/COMMUNITY-LINK-RULES.md`** + **`community-autopilot.md`** + **`ONE-LINE-INTENTS.md`**.

**Before any reply:** `GET /api/agent/briefing` or specific endpoint.

---

## ROUTING GUARD

```
if message matches community intent:
  1. use_skill("bankr-communities")
  2. SITE = env COMMUNITIES_SITE_URL or default https://bankr-community.vercel.app
  3. if read-only (latest, members, list, search):
       GET briefing or community-link API → include communityLink (NEVER bankr.bot) → STOP
  4. if write (post, verify, create, react):
       wallet = linked Bankr wallet (never ask on tweet if linked)
       header x-wallet-address: wallet
       if post/react: GET /api/holders/{token}?wallet= first
       POST appropriate endpoint → STOP
  5. never fabricate stats
```

---

## Hard rules

1. **Never** skip API call for stats/posts/members.
2. **Never** require `use_skill` in user tweet text.
3. **Never** post without holder check.
4. **Never** verify without owner wallet.
5. **Never** link `bankr.bot` or `t.co` for communities — only `bankr-community.vercel.app/community/0x{contract}`.
6. **Tweet = DM** — same skill load order as TMP (`BANKR-PLATFORM-TWEET-INTAKE.md`).

---

## TMP coexistence

| Intent | Route to |
|--------|----------|
| claim fees, list, buy, launch | TMP skills |
| community social | **this skill** |

If both in one message, run both skills sequentially.
