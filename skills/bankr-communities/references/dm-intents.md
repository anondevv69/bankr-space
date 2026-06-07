# DM / terminal — community intents

**Plain language:** see **`ONE-LINE-INTENTS.md`**.

---

## Read intents (no signing)

| User asks | Agent |
|-----------|-------|
| What's new in $TMP community? | briefing API |
| How many members? | briefing → memberCount |
| Show recent posts | GET community + posts |
| List communities | GET /api/communities |
| Find token PEPE on Bankr | GET /api/tokens/search |

---

## Write intents (linked wallet)

| User asks | Agent |
|-----------|-------|
| Create community for $X | search → POST community |
| Verify $X community | POST verify (owner) |
| Post "…" in $X community | holder check → POST post |
| React 👍 to post | holder check → POST react |

---

## Portfolio-style questions

| Question | API |
|----------|-----|
| Which communities exist for tokens I launched? | GET communities + filter by ownerWallet |
| Can I post in $TMP? | GET holders?wallet={linked} |
| Is $TMP community verified? | briefing → community.verified |

---

## Multi-skill threads

User may combine TMP + communities in one session:

```text
claim fees for CTO
what's the latest in CTO community?
```

Run TMP skill for claim, then communities skill for briefing — same linked wallet.
