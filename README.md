# Here Chat App Monorepo

Next.js frontend + Socket.IO/Express backend + Cosmos DB + Azure Entra ID auth.

## Project structure

- `apps/web`: Next.js UI
- `apps/chat-api`: Express REST + Socket.IO realtime server
- `packages/shared`: shared helpers

## Prerequisites

- Node.js 20+ (or current LTS)
- Azure Entra tenant
- Azure Cosmos DB account

## 1) Install dependencies

From repo root:

```bash
npm install
```

## 2) Create env files

From repo root:

```bash
copy .env.example .env
copy apps\\web\\.env.example apps\\web\\.env.local
copy apps\\chat-api\\.env.example apps\\chat-api\\.env
```

## 3) Azure Entra setup (required)

Create **two** app registrations.

### A. SPA app registration (frontend)

- Platform: `Single-page application`
- Redirect URI: `http://localhost:3000`
- Copy `Application (client) ID` -> `NEXT_PUBLIC_ENTRA_CLIENT_ID`

### B. API app registration (backend resource)

- Go to `Expose an API`
- Set `Application ID URI` (example: `api://<API_APP_CLIENT_ID>`)
- Create delegated scope: `Chat.Access`
- Full scope value example: `api://<API_APP_CLIENT_ID>/Chat.Access`

### C. Grant SPA permission to API scope

- Open SPA app -> `API permissions` -> `Add a permission` -> `My APIs`
- Select API app -> `Delegated permissions` -> check `Chat.Access`
- Grant/admin consent

## 4) Configure environment variables

### `apps/web/.env.local`

```env
NEXT_PUBLIC_CHAT_API_URL=http://localhost:3001
NEXT_PUBLIC_ENTRA_CLIENT_ID=<SPA_APP_CLIENT_ID>
NEXT_PUBLIC_ENTRA_TENANT_ID=<TENANT_ID>
NEXT_PUBLIC_ENTRA_AUTHORITY=https://login.microsoftonline.com/<TENANT_ID>
NEXT_PUBLIC_ENTRA_REDIRECT_URI=http://localhost:3000
NEXT_PUBLIC_CHAT_API_SCOPE=api://<API_APP_CLIENT_ID>/Chat.Access
```

### `apps/chat-api/.env`

```env
CHAT_API_PORT=3001
WEB_ORIGIN=http://localhost:3000
AUTH_MODE=entra

ENTRA_TENANT_ID=<TENANT_ID>
ENTRA_AUDIENCE=api://<API_APP_CLIENT_ID>

# Optional overrides:
# ENTRA_ISSUER=https://login.microsoftonline.com/<TENANT_ID>/v2.0
# ENTRA_JWKS_URI=https://login.microsoftonline.com/<TENANT_ID>/discovery/v2.0/keys

# Key Vault (recommended for production)
KEY_VAULT_ENABLED=false
KEY_VAULT_URI=https://<vault-name>.vault.azure.net/
KEY_VAULT_ALLOW_LOCAL_FALLBACK=true
KEY_VAULT_SECRET_COSMOS_CONNECTION_STRING=chatapi--prod--cosmos-connstr
# Optional if using endpoint+key instead of connection string:
# KEY_VAULT_SECRET_COSMOS_ENDPOINT=chatapi--prod--cosmos-endpoint
# KEY_VAULT_SECRET_COSMOS_KEY=chatapi--prod--cosmos-key

COSMOS_CONNECTION_STRING=AccountEndpoint=...;AccountKey=...;
COSMOS_DATABASE_ID=chat_app
COSMOS_MESSAGES_CONTAINER_ID=messages
COSMOS_USERS_CONTAINER_ID=users
```

Notes:
- Backend validator accepts both Entra v2 issuer (`login.microsoftonline.com/.../v2.0`) and Entra v1 issuer (`sts.windows.net/.../`).
- If Entra auth is not ready yet, set `AUTH_MODE=legacy` for local non-auth mode.
- Keep secrets out of `apps/web/.env.local` and all `NEXT_PUBLIC_*` variables.

## 5) Production: Azure Key Vault + Managed Identity

1. Enable `System assigned` managed identity on your API host (App Service, Container Apps, or AKS workload identity).
2. Grant that identity `Key Vault Secrets User` RBAC role on the vault.
3. Set `KEY_VAULT_ENABLED=true`, `KEY_VAULT_URI`, and secret-name env vars on the API runtime.
4. Store secret values in Key Vault (for example `chatapi--prod--cosmos-connstr`).
5. Keep `COSMOS_*` env vars for local development fallback only.
6. For strict production behavior, set `KEY_VAULT_ALLOW_LOCAL_FALLBACK=false`.

Operational reference: `docs/security/key-vault-runbook.md`.

## 6) Run

From repo root:

```bash
npm run dev
```

Or separately:

```bash
npm run dev:web
npm run dev:api
```

URLs:
- Web: `http://localhost:3000`
- API: `http://localhost:3001`
- Health: `http://localhost:3001/health`

## 7) Run With Docker

Build and run both services:

```bash
docker compose up --build
```

Run in detached mode:

```bash
docker compose up --build -d
```

Stop:

```bash
docker compose down
```

Publish images:

```bash
docker build -f Dockerfile.api -t <registry>/chat-app-api:<tag> .
docker build -f Dockerfile.web \
  --build-arg NEXT_PUBLIC_CHAT_API_SCOPE=api://<API_APP_CLIENT_ID>/Chat.Access \
  -t <registry>/chat-app-web:<tag> .
docker push <registry>/chat-app-api:<tag>
docker push <registry>/chat-app-web:<tag>
```

Notes:
- `web` uses `NEXT_PUBLIC_*` build args from your shell environment (or defaults in `docker-compose.yml`).
- `chat-api` reads runtime env values (including Key Vault settings) from `docker-compose.yml`.

### Production compose (prebuilt images, no local build)

Set required environment variables in your shell or deployment system:

```bash
CHAT_API_IMAGE=<registry>/chat-app-api:<tag>
WEB_IMAGE=<registry>/chat-app-web:<tag>
WEB_ORIGIN=https://<your-web-domain>
```

Start:

```bash
docker compose -f compose.prod.yml pull
docker compose -f compose.prod.yml up -d
```

Inspect:

```bash
docker compose -f compose.prod.yml ps
docker compose -f compose.prod.yml logs -f
```

Stop:

```bash
docker compose -f compose.prod.yml down
```

Rebuild only the web image (to apply changed `NEXT_PUBLIC_*` values):

```bash
docker compose -f compose.prod.yml --profile build-web build web
docker compose -f compose.prod.yml up -d
```

## 8) Infrastructure (Terraform)

Terraform foundation lives in `infra/` and is currently scoped to `dev`.

### What Terraform manages in phase 1

- Resource Group
- Virtual Network + subnets for App Gateway, App Service integration, and private endpoints
- Key Vault (soft-delete and purge protection enabled, public network access disabled)
- Storage Account (TLS1.2+, no public blob access)
- Log Analytics + Application Insights

### Prerequisites

- Terraform `>= 1.6.0`
- Azure credentials with access to your target subscription
- Pre-created remote state backend resources:
  - Resource Group (for example `rg-tf-state`)
  - Storage Account (globally unique)
  - Blob Container (for example `tfstate`)

### Local Terraform commands

```bash
cd infra
terraform fmt -check -recursive
terraform init \
  -backend-config="resource_group_name=<rg-tf-state>" \
  -backend-config="storage_account_name=<tfstate-storage-account>" \
  -backend-config="container_name=tfstate" \
  -backend-config="key=chat-app-dev.tfstate"
terraform validate
terraform plan -var-file=dev.tfvars
```

### GitHub Actions behavior

Workflow: `.github/workflows/terraform-foundation.yml`

- Pull Requests: `fmt`, `init`, `validate`, `plan` and upload plan artifact
- Push to `main`: `fmt`, `init`, `validate`, `plan`, then `apply` for `dev.tfvars`

Required GitHub configuration:

- Secrets:
  - `TF_AZURE_CLIENT_ID`
  - `TF_AZURE_TENANT_ID`
  - `TF_AZURE_SUBSCRIPTION_ID`
- Repository Variables:
  - `TFSTATE_RESOURCE_GROUP`
  - `TFSTATE_STORAGE_ACCOUNT`
  - `TFSTATE_CONTAINER`

### Terraform outputs for app integration

Key outputs from `infra/outputs.tf` are intended for downstream app/runtime wiring:

- `resource_group_name`
- `key_vault_uri`
- `subnet_ids`
- `application_insights_connection_string` (sensitive)
- `storage_account_name`

## Expected login/data flow

1. User signs in via Microsoft on web app.
2. Web acquires access token for `NEXT_PUBLIC_CHAT_API_SCOPE`.
3. Web calls `POST /auth/sync-user` with Bearer token.
4. API validates token and upserts user into Cosmos `users` container.
5. Web opens Socket.IO connection with token in handshake auth.

## API routes

- `GET /` public
- `GET /health` public
- `POST /auth/sync-user` authenticated
- `GET /users/:userId` authenticated
- `GET /rooms/:roomId/messages` authenticated
- `GET /rooms/:roomId/members` authenticated
- `POST /rooms/:roomId/members` authenticated

## Troubleshooting

- `401 Unauthorized` on `/auth/sync-user`:
  - Check `ENTRA_AUDIENCE` exactly matches token `aud`
  - Check `NEXT_PUBLIC_CHAT_API_SCOPE` exactly matches exposed scope
  - Confirm SPA app has delegated permission + consent for `Chat.Access`
- `GET /Redirect 404`:
  - Use `NEXT_PUBLIC_ENTRA_REDIRECT_URI=http://localhost:3000` (or create a real `/Redirect` page)
- User not added to Cosmos:
  - Verify `/auth/sync-user` returns `200`
  - Verify Cosmos DB/containers and credentials in `apps/chat-api/.env`
- Port in use:
  - Kill process on `3000`/`3001` before restart

## Security note

Never commit real secrets (`COSMOS_KEY`, connection strings, tokens). If leaked, rotate keys immediately.

