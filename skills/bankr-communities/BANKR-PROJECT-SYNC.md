# Bankr Agent Profile sync (Space ↔ bankr.bot/agents)

Spaces mirror to **[Bankr Agent Profiles](https://docs.bankr.bot/agent-profiles/overview)** at `bankr.bot/agents`.

**Two paths** — use **Path B on X** (no API key on bankr.space).

---

## Path A — Space site auto-sync (optional)

Fee recipient on bankr.space: Edit profile → **Bankr project sync** → paste `bk_…` → enable profile/post sync.

After that, `PATCH` / `POST` on bankr.space auto-call Bankr profile API server-side.

---

## Path B — @bankrbot reads Space → writes Bankr project (preferred on X)

Bankr platform already has the user's **linked wallet** + **`bk_…` API key**. bankr.space only **serves** mapped profile data.

### User says

```text
@bankrbot create Bankr project from Space space
@bankrbot sync my Space to bankr.bot agents
@bankrbot add $TMP space as my Bankr project
@bankrbot update my Bankr project from ARCHIVE space
```

### Steps (@bankrbot)

```
1. use_skill("bankr-communities") → read this doc
2. Resolve token (SPACE → 0xef703b860a6d422fa00cc67bbbb2662297cb6ba3)
3. GET /api/holders/{token}?wallet={linked} → must be fee recipient → else 403 message + communityLink
4. GET /api/agent/bankr-project-payload?symbol=SPACE
   Header (optional): x-wallet-address: {linked}
   → bankrProfilePayload, communityLink, existingBankrProfile
5. Upsert on Bankr (user's API key — on Bankr platform, NEVER in tweet):

   Option A — one-shot via bankr.space (forwards to api.bankr.bot):
   POST /api/agent/bankr-project-payload?symbol=SPACE
   Headers: X-API-Key: {user_bk_key}, x-wallet-address: {linked}

   Option B — direct Bankr API (same payload from step 4):
   POST https://api.bankr.bot/agent/profile     (if no profile)
   PUT  https://api.bankr.bot/agent/profile     (if existingBankrProfile)
   Headers: X-API-Key: {user_bk_key}
   Body: bankrProfilePayload from step 4

6. Reply paste tweetReply from POST response, or:
   "Bankr project created/updated from $SYMBOL Space ✓"
   https://bankr.bot/agents/{slug or token}
   https://bankr.space/community/0x…
```

### Payload mapping (from Space GET)

| `bankrProfilePayload` field | Source on Space |
|----------------------------|-----------------|
| `projectName` | token name |
| `description` | merged profile description |
| `tokenAddress` | contract |
| `website` | social website or Space URL |
| `profileImageUrl` | HTTPS icon (incl. pbs.twimg.com hotlink) |
| `products[]` | enabled fundraisers + agent pool goals |
| `revenueSources[]` | trading fees + Space link |

---

## Ongoing sync on X (after project exists)

| User tweet | Agent does |
|------------|------------|
| Profile/banner/description update | `PATCH` bankr.space (BENEFICIARY-ACTIONS) **then** repeat Path B step 5 (or enable Path A on site) |
| Post in space | `POST …/posts` + `POST api.bankr.bot/agent/profile/update` with post text |
| "sync project from space" only | Path B steps 4–5 (refresh from latest Space data) |

**Post → project update (direct Bankr):**

```http
POST https://api.bankr.bot/agent/profile/update
X-API-Key: bk_…
{ "title": "first line of post", "content": "full post text" }
```

Or include in one-shot:

```http
POST /api/agent/bankr-project-payload?symbol=SPACE
X-API-Key: bk_…
x-wallet-address: 0x…
{ "projectUpdateTitle": "…", "projectUpdateContent": "…" }
```

---

## API reference (bankr.space)

```http
GET  /api/agent/bankr-project-payload?symbol=SPACE
GET  /api/agent/bankr-project-payload?token=0x…
POST /api/agent/bankr-project-payload?symbol=SPACE
     Headers: X-API-Key, x-wallet-address
```

[Bankr Agent Profiles REST API](https://docs.bankr.bot/agent-profiles/rest-api)

---

## Fail rules

- **Never** ask user to paste `bk_…` in a tweet — Bankr platform uses stored key.
- **Never** say "enable sync on bankr.space first" if user asked **create project from Space** — use Path B.
- Fee recipient only for writes.
- 409 on create → `PUT /agent/profile` instead.
- Profile `approved: false` until Bankr admin review — still reply with profile URL.

See also: **BENEFICIARY-ACTIONS.md**, **X-TWEET-IMAGE-PROFILE.md**
