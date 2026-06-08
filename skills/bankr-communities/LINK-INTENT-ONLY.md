# Link & community search — Bankr agent flow

> When user asks for a **link**, **URL**, or **community page** for a ticker/token.

## One API to call

```http
GET https://bankr-community.vercel.app/api/agent/resolve-community?q=TMP
GET https://bankr-community.vercel.app/api/agent/resolve-community?q=ARCHIVE
GET https://bankr-community.vercel.app/api/agent/resolve-community?q=0x935e13a28849095db45e63040f109c34b757aba3
GET https://bankr-community.vercel.app/api/agent/resolve-community?q=TokenMarketplace&format=text
```

Accepts: **ticker** (`TMP`), **token name** (`TokenMarketplace`), or **contract address** (`0x…`).

## Search order (server-side)

1. **Existing communities** — match symbol, name, or contract in our database
2. **If no community** — search Bankr token launches for ticker/name/address
3. **Build link** — `https://bankr-community.vercel.app/community/{contractAddress}`

## Tweet reply

Paste **`tweetReply`** or **`communityLink`** from the JSON — one line, full https URL.

```json
{
  "ok": true,
  "source": "existing_community",
  "communityExists": true,
  "communityLink": "https://bankr-community.vercel.app/community/0x935e...",
  "tweetReply": "https://bankr-community.vercel.app/community/0x935e..."
}
```

If `communityExists: false` but `ok: true` — still paste the link (token found, community not created yet). Optional: mention `hint` in a follow-up.

## Search existing communities only

```http
GET https://bankr-community.vercel.app/api/agent/search-communities?q=archive
```

Returns all matching **live** communities with links. Use when user asks "list communities matching X".

## Steps for Bankr

```
1. use_skill("bankr-communities")
2. Extract ticker/name/address from user message (strip $)
3. GET /api/agent/resolve-community?q={query}
4. If ok → tweet = communityLink (one line) → STOP
5. If 404 → say no token/community found for that query
```

## FORBIDDEN

- `bankr.bot`, `t.co`, `/community/TMP` (symbol in path)
- FAQ when user only asked for a link
- "I wasn't able to generate a response" without calling resolve-community

## Examples

| User says | Call | Tweet reply |
|-----------|------|-------------|
| link to TMP community | `?q=TMP` | `https://bankr-community.vercel.app/community/0x935e13a28849095db45e63040f109c34b757aba3` |
| link to ARCHIVE | `?q=ARCHIVE` | `https://bankr-community.vercel.app/community/0x76aba8089e4ba07f705fb886d17dd41793ad2ba3` |
| community page for 0x935e… | `?q=0x935e…` | same URL |
