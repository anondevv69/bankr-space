# DM / terminal — space intents

**Plain language:** see **`references/one-line-intents.md`**.

---

## Read intents (no signing)

| User asks | Agent |
|-----------|-------|
| What's new in $TMP space? | briefing API |
| How many members? | briefing → memberCount |
| Show recent posts | GET `/api/communities/{token}` + posts |
| List spaces | GET /api/communities |
| Find token PEPE on Bankr | GET /api/tokens/search |
| What's the link to $TMP? | instant table or GET /api/agent/link |

---

## Write intents (linked wallet)

| User asks | Agent |
|-----------|-------|
| Create space for $X | search → POST `/api/communities/{token}` |
| Verify $X space / community | POST verify (owner) |
| Post "…" in $X space / community | holder check → POST post |
| React 👍 to post | holder check → POST react |
| Update profile / add links | PATCH community (beneficiary) |
| Pin post | POST pin-post (verified beneficiary) |

---

## Portfolio-style questions

| Question | API |
|----------|-----|
| Which communities exist for tokens I launched? | GET communities + filter by ownerWallet |
| Can I post in $TMP? | GET holders?wallet={linked} |
| Is $TMP space verified? | briefing → community.verified |

---

## Multi-skill threads

User may combine TMP + communities in one session:

```text
claim fees for CTO
what's the latest in CTO space?
```

Run TMP skill for claim, then Bankr Space skill for briefing — same linked wallet.
