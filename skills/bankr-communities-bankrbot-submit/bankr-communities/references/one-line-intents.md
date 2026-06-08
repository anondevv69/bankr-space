# One-line intents — Bankr Space

> User gives **one sentence** → agent runs **full flow** without interview.

**Site base:** `https://bankr.space` (or `{COMMUNITIES_SITE_URL}` env override)

---

## Read-only (no wallet tx)

| User says | API | Reply |
|-----------|-----|-------|
| what's the link to **$TMP** space? | `GET /api/agent/link?q=TMP` → paste response body (plain text URL) |
| search live spaces **archive** | `GET /api/agent/search-communities?q=archive` |
| what's the latest on **$TMP** space? | briefing → paste **`replyText` verbatim** (URL on **last** line) |
| how many **members** in **CTO** space? | `GET /api/agent/briefing?symbol=CTO` → `stats.memberCount` | "N members in $CTO space" |
| show **recent posts** for **0x935e…** | `GET /api/communities/0x935e…` | summarize last 5 posts |
| **list** all spaces | `GET /api/communities` | count + top symbols |
| search Bankr token **PEPE** | `GET /api/tokens/search?q=PEPE` | launches found |
| is there a space for **$TMP**? | `GET /api/agent/briefing?symbol=TMP` | yes/no + link |
| what **opportunities** on spaces? | briefing → `opportunities[]` | unverified, first post, create space |

---

## Write (linked wallet + API)

| User says | Flow |
|-----------|------|
| **start** / **create** space for **$TMP** | search → `POST /api/communities/{token}` `{ description? }` + header `x-wallet-address: {linked}` |
| **verify** **$TMP** space | `GET /api/holders/{token}?wallet={linked}` → `POST /api/communities/{token}/verify` (fee beneficiary) |
| **update** / **add links** to **$TMP** profile | `GET /api/communities/{token}` → merge → `PATCH /api/communities/{token}` `{ description, socialLinks }` (beneficiary) |
| **pin** post in **TMP** / **pin it** after post | `POST /api/communities/{token}/pin-post` `{ postId, action: "pin" }` (verified beneficiary) |
| **post** in **TMP** space: {text} **and pin** | post → then pin-post if `canPinPosts` |
| **post** in **TMP** space: {text} | holder check → `POST …/posts` **with `source`** (POST-SOURCE.md) |
| **comment** in **0x935e…** space: {text} | same as post |
| react **👍** on post **{id}** in **TMP** | `POST /api/posts/{id}/react` `{ tokenAddress, reaction: "👍" }` |

---

## Tweet examples (sufficient — no "use skill")

```text
@bankrbot what's the latest on the TMP space?
@bankrbot what's the latest on the TMP community?   ← same intent
@bankrbot verify the TMP space
@bankrbot add website https://tokenmarketplace.shop to TMP space profile
@bankrbot post in TMP space: launch update — pin it
@bankrbot pin the latest post in TMP space
@bankrbot post in TMP space: gm holders
@bankrbot start a space for 0x935e13a28849095db45e63040f109c34b757aba3
```

---

## Forbidden

- Reply without calling site API first
- Ask "which skill?" or "paste use_skill"
- Ask wallet if user is X↔Bankr linked
- Say "open the website" when API write is available
- Fabricate member counts or posts

---

## Combined with TMP

| Domain | Skill |
|--------|-------|
| List / buy / claim fees / launch | `bankr-tmp-skill` |
| Space posts / verify / members | `bankr-communities` (this) |

Example thread:

```text
@bankrbot claim fees for CTO          → TMP skill
@bankrbot what's new in CTO space → Bankr Space skill
```
