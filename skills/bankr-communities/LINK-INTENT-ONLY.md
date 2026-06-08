# Link & community search — Bankr agent flow

> When user asks for a **link**, **URL**, or **community page** for a ticker/token.

## One API to call

```http
GET https://bankr-community.vercel.app/api/agent/resolve-community?q=TMP
GET https://bankr-community.vercel.app/api/agent/resolve-community?q=ARCHIVE
GET https://bankr-community.vercel.app/api/agent/resolve-community?q=0x935e13a28849095db45e63040f109c34b757aba3
```

Accepts: **ticker** (`TMP`), **token name** (`TokenMarketplace`), or **contract address** (`0x…`).

## Search order (server-side)

1. **Existing communities** — match symbol, name, or contract → return `communityLink`
2. **If no community** — search Bankr token launches for ticker/name/address
3. **Token found, no community** → ask user if they want to create one (`suggestCreateCommunity: true`)
4. **Nothing found** → 404

## Tweet reply

### Community exists (`communityExists: true`)

Paste **`communityLink`** — one line:

```text
https://bankr-community.vercel.app/community/0x935e13a28849095db45e63040f109c34b757aba3
```

### No community yet (`suggestCreateCommunity: true`)

Paste **`tweetReply`** — ask to create:

```text
No $FOO community yet — TokenName is on Bankr. Would you like me to create the community?
```

If user says **yes** → `POST /api/communities/{tokenAddress}` with linked wallet → then reply with new `communityLink`.

Do **not** share a link to a community that doesn't exist yet.

## Search existing communities only

```http
GET https://bankr-community.vercel.app/api/agent/search-communities?q=archive
```

## Steps for Bankr

```
1. use_skill("bankr-communities")
2. Extract ticker/name/address from user message (strip $)
3. GET /api/agent/resolve-community?q={query}
4. If communityExists → tweet = communityLink → STOP
5. If suggestCreateCommunity → tweet = tweetReply (ask to create) → STOP
6. If 404 → say no token/community found
7. If user confirms create → POST createCommunityAction → reply with communityLink
```

## FORBIDDEN

- `bankr.bot`, `t.co`, `/community/TMP` (symbol in path)
- Link to a page when community doesn't exist yet
- FAQ when user only asked for a link
