# Key Vault Secret Rotation Runbook

## Scope

This runbook covers secret operations for `apps/chat-api` in Azure.

## Ownership

- Service owner: Chat API on-call
- Security owner: Platform security team
- Rotation cadence: every 90 days or immediately after suspected exposure

## Secret Inventory

- `chatapi--<env>--cosmos-connstr` (preferred current secret)
- Optional legacy split secrets:
  - `chatapi--<env>--cosmos-endpoint`
  - `chatapi--<env>--cosmos-key`
- Optional Entra settings if managed centrally:
  - `chatapi--<env>--entra-tenant-id`
  - `chatapi--<env>--entra-audience`
  - `chatapi--<env>--entra-issuer`
  - `chatapi--<env>--entra-jwks-uri`

## Pre-checks

1. Confirm API host managed identity is enabled.
2. Confirm identity has `Key Vault Secrets User` role on vault.
3. Confirm Key Vault soft-delete and purge protection are enabled.
4. Confirm app settings include:
   - `KEY_VAULT_ENABLED=true`
   - `KEY_VAULT_URI=https://<vault>.vault.azure.net/`
   - secret-name mapping env vars (`KEY_VAULT_SECRET_*`)

## Rotation Procedure

1. Create a new secret version in Key Vault for the target secret.
2. Validate secret metadata (name, content type, enabled state, expiry).
3. Restart the API app to force fresh client initialization.
4. Run smoke checks:
   - `GET /health` returns `200`
   - authenticated call to `POST /auth/sync-user`
   - message send/read path works
5. Monitor error rates for 15 minutes.

## Rollback

1. Restore prior secret version as current version.
2. Restart API app.
3. Re-run smoke checks.

## Alerting and Auditing

- Alert on Key Vault `403` and `429` spikes for the API managed identity.
- Alert on chat-api startup failures with "Key Vault" in logs.
- Keep access diagnostics enabled for Key Vault and API runtime.

## Safety Rules

- Never log secret values.
- Never put secrets in frontend (`NEXT_PUBLIC_*`) env vars.
- Prefer Cosmos DB Entra RBAC over long-lived account keys when feasible.
