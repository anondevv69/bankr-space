# Bankr Agent Profile sync (Space ↔ bankr.bot/agents)

Spaces can mirror profile fields and posts to a **[Bankr Agent Profile](https://docs.bankr.bot/agent-profiles/overview)** at `bankr.bot/agents`.

**One-time setup (fee recipient on site):** Edit profile → **Bankr project sync** → paste `bk_…` API key from [bankr.bot/api-keys](https://bankr.bot/api-keys) → enable profile and/or post sync.

After that, **@bankrbot profile writes auto-sync** — no extra API calls from the agent.

---

## What syncs automatically (server-side)

When `bankrProject.enabled` is true on the Space:

| Space action | Bankr project |
|--------------|---------------|
| `PATCH` profile (description, website, banner/icon URLs) | `PUT /agent/profile` (name, description, token, website, products, image) |
| Privileged `POST` top-level post (if `syncPosts` on) | `POST /agent/profile/update` (project update feed) |

**Agent does not** call Bankr profile API directly — Space backend uses the stored API key.

---

## Agent-visible API

```http
GET /api/communities/{tokenAddress}
```

Response includes:

- `community.bankrProject.enabled`, `syncProfile`, `syncPosts`, `apiKeyConfigured`, `lastSyncedAt`
- `bankrAgentProfile` — public profile from `GET /agent-profiles/{token}` (project updates, market cap)

---

## @bankrbot examples (same as profile PATCH)

These already trigger Bankr project sync when enabled:

```text
@bankrbot set TMP space description: Holder hub for updates
@bankrbot add website https://example.com to Space space profile
@bankrbot use this as Space banner          ← X-TWEET-IMAGE-PROFILE.md
@bankrbot post in Space space: v2 shipped   ← also project update if syncPosts
```

**Reply on X after profile update:**

> Updated $SPACE space profile (synced to Bankr project ✓)  
> https://bankr.space/community/0xef703b…

If `bankrProject.enabled` is false, reply normally without claiming project sync.

---

## Posts → project updates

When post sync is on, privileged posters (fee recipient, delegate, deployer when allowed) publish top-level posts with:

```json
{ "content": "…", "syncToBankrProject": true }
```

Default: **true** when sync enabled — user can uncheck on site. @bankrbot posts should include `syncToBankrProject: true` unless user says "space only" / "don't sync to project".

---

## Bankr project only (no Space API key on site)

User can manage profile directly via Bankr CLI/API — outside this skill:

```bash
bankr agent profile add-update --title "Launch" --content "Shipped v2"
```

Space sync is the recommended path when a Space already exists.

---

## Fail rules

- **Never** ask user to paste `bk_…` API key in a tweet — site only.
- **Never** call `api.bankr.bot/agent/profile` from @bankrbot — Space backend handles sync.
- If user asks "sync my Space to Bankr project" and sync is off → reply: enable in Edit profile on bankr.space + link to space.

See also: **BENEFICIARY-ACTIONS.md**, **X-TWEET-IMAGE-PROFILE.md**, [Agent Profiles docs](https://docs.bankr.bot/agent-profiles/overview)
