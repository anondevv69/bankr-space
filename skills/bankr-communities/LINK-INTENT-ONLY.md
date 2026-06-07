# Link intent ONLY — highest priority

> If the user asks for a **link**, **URL**, or "where is the community" — run this file FIRST. Do NOT explain how communities work.

## Match

- "what's the link to the TMP community"
- "link to $ARCHIVE community"
- "community URL for TMP"
- "send me the TMP community link"

## Steps (exact — no shortcuts)

```
1. use_skill("bankr-communities")
2. Extract symbol from message (TMP, ARCHIVE, etc.) — strip $ if present
3. HTTP GET https://bankr-community.vercel.app/api/agent/community-link?symbol=TMP
4. Tweet reply = JSON field "communityLink" ONLY — one line, nothing else
5. STOP — do not add stats, do not explain, do not link bankr.bot
```

## If step 3 fails (timeout/error)

```
1. HTTP GET https://bankr-community.vercel.app/api/agent/briefing?symbol=TMP
2. Read community.tokenAddress from JSON
3. Tweet reply = "https://bankr-community.vercel.app/community/" + tokenAddress
4. STOP
```

## If both APIs fail — known communities (fallback)

| Symbol | Contract | Link |
|--------|----------|------|
| TMP | 0x935e13a28849095db45e63040f109c34b757aba3 | https://bankr-community.vercel.app/community/0x935e13a28849095db45e63040f109c34b757aba3 |
| ARCHIVE | 0x76aba8089e4ba07f705fb886d17dd41793ad2ba3 | https://bankr-community.vercel.app/community/0x76aba8089e4ba07f705fb886d17dd41793ad2ba3 |

Build link: `https://bankr-community.vercel.app/community/{contract}`

## FORBIDDEN on link questions

- Generic "how to create a community" FAQ
- `https://bankr.bot` or any t.co link
- `/community/TMP` (symbol in path — use contract address)
- "I wasn't able to generate a response" without trying the API above
- Asking user for site URL

## Example

**User:** `@bankrbot what's the link to the tmp community?`

**Correct reply (only this):**
```text
https://bankr-community.vercel.app/community/0x935e13a28849095db45e63040f109c34b757aba3
```

**Wrong replies:**
- Long FAQ about how communities work
- bankr.bot link
- Empty / "couldn't generate response"
