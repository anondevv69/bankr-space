# Link questions — read GET-LINK.md

> User asks: **"what's the link to the TMP community?"** (or any ticker)

**Read `GET-LINK.md` and run the GET call.** Response body = tweet reply.

```http
GET https://bankr-community.vercel.app/api/agent/link?q=TMP
```

Terminal test:

```bash
curl "https://bankr-community.vercel.app/api/agent/link?q=TMP"
```

Returns one line plain text — paste it as the tweet. No JSON parsing needed.

If GET fails → fallback links in `known-communities.json`. **Never** reply empty or "couldn't generate a response."
