# Submit `bankr-communities` to BankrBot/skills

PR-ready copy structured like [BankrBot/skills](https://github.com/BankrBot/skills) (same pattern as [PR #504 github-vesting](https://github.com/BankrBot/skills/pull/504)).

## Open PR

**https://github.com/BankrBot/skills/pull/459**

Branch: `anondevv69:add-bankr-communities` on `BankrBot/skills`

## Update PR (after skill changes on bankr-space)

```bash
# From bankr-space repo
rsync -a --exclude 'skill-manifest.json' skills/bankr-communities/ /path/to/skills/bankr-communities/

# Copy BankrBot-specific files from this folder
cp skills/bankr-communities-bankrbot-submit/bankr-communities/catalog.json /path/to/skills/bankr-communities/
cp skills/bankr-communities-bankrbot-submit/bankr-communities/known-hosts.json /path/to/skills/bankr-communities/
cp -R skills/bankr-communities-bankrbot-submit/bankr-communities/references/API-HOST.md \
       skills/bankr-communities-bankrbot-submit/bankr-communities/references/RESPONSE-SAFETY.md \
       skills/bankr-communities-bankrbot-submit/bankr-communities/references/BANKR-API-KEYS.md \
       skills/bankr-communities-bankrbot-submit/bankr-communities/references/BANKR-SUBMIT.md \
       /path/to/skills/bankr-communities/references/

# Merge CRITICAL security block from bankr-communities-bankrbot-submit/bankr-communities/SKILL.md

git add bankr-communities/ README.md
git commit -m "Update bankr-communities skill (Bankr Space)."
git push origin add-bankr-communities
```

## Install (after merge)

```text
install the bankr-communities skill from https://github.com/BankrBot/skills/tree/main/bankr-communities
```

## Security docs (review checklist)

| File | Purpose |
|------|---------|
| `catalog.json` | `slug` = `bankr-communities` |
| `known-hosts.json` | URL allowlist + instant links |
| `references/API-HOST.md` | Pinned API hosts |
| `references/RESPONSE-SAFETY.md` | No verbatim API text relay |
| `references/BANKR-API-KEYS.md` | `bk_…` never in tweets |
| `references/BANKR-SUBMIT.md` | No Bankr scan bypass |

## Test

```bash
./bankr-communities/scripts/get-community-link.sh TMP
curl "https://www.bankr.space/api/agent/briefing?symbol=Space"
```
