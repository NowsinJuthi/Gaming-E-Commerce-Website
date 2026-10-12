# Plaintext inventory and delivered-code migration

Production refuses to boot while plaintext gift codes remain, unless
`ALLOW_LEGACY_PLAINTEXT_SECRETS=true` is set **only for the migration window**.
Fail-closed counts include inventory `value`, order/reseller delivered
`code` / `serial` / `pin`, and order `manualGiftCards.code`.

Secrets are never printed. Take a Mongo backup first.

## Dry-run

```bash
corepack pnpm --filter @uniqbd/api migrate:encrypt-codes
```

Counts inventory `value`, order delivered codes / serial / PIN / manual cards,
and reseller order codes. Already-prefixed `enc:v1:` values are skipped.

## Apply

```bash
# 1. Backup MongoDB
# 2. Set DATA_ENCRYPTION_KEY (32-byte base64) and MONGODB_URI
node apps/api/scripts/encrypt-delivered-codes.cjs --apply
```

Safe to re-run. After counts are zero, remove `ALLOW_LEGACY_PLAINTEXT_SECRETS`
and restart the API.

## Historical superseded payments

Failed intents with message `Superseded by a new checkout` and a gateway
reference can miss a late capture. Dry-run then apply:

```bash
node apps/api/scripts/recover-superseded-payments.cjs
node apps/api/scripts/recover-superseded-payments.cjs --apply
```
