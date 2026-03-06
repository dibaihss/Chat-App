# Chat App Monorepo (Next.js + Socket.IO + Cosmos DB + Entra ID)

This repository now uses a single repo with separated apps:

- `apps/web`: Next.js frontend
- `apps/chat-api`: REST + Socket.IO backend
- `packages/shared`: shared chat helpers/contracts

Cosmos DB is the source of truth for:

- message history (`messages` container)
- user profiles (`users`)
- room metadata (`rooms`)
- room memberships (`room_memberships`)

## Setup

1. Install dependencies from repo root:

```bash
npm install
```

2. Copy environment examples:

```bash
copy .env.example .env
copy apps\\chat-api\\.env.example apps\\chat-api\\.env
copy apps\\web\\.env.example apps\\web\\.env.local
```

3. Fill Cosmos credentials and Entra values in `apps/chat-api/.env`.
4. Fill Entra frontend values in `apps/web/.env.local`.

## Azure Entra ID setup

Create two app registrations:

1. Web app registration (SPA):
- Add redirect URI: `http://localhost:3000`
- Use this as `NEXT_PUBLIC_ENTRA_CLIENT_ID`

2. API app registration:
- Expose an API scope (for example: `api://<api-client-id>/Chat.Access`)
- Use API audience in backend `ENTRA_AUDIENCE` (`api://<api-client-id>` or configured audience)

Required frontend env (`apps/web/.env.local`):
- `NEXT_PUBLIC_ENTRA_CLIENT_ID`
- `NEXT_PUBLIC_ENTRA_TENANT_ID`
- `NEXT_PUBLIC_ENTRA_AUTHORITY`
- `NEXT_PUBLIC_CHAT_API_SCOPE`
- `NEXT_PUBLIC_CHAT_API_URL`

Required backend env (`apps/chat-api/.env`):
- `AUTH_MODE=entra`
- `ENTRA_TENANT_ID`
- `ENTRA_ISSUER`
- `ENTRA_AUDIENCE`
- `ENTRA_JWKS_URI`

## Run

Start both apps:

```bash
npm run dev
```

Or run separately:

```bash
npm run dev:web
npm run dev:api
```

Default URLs:

- Web: `http://localhost:3000`
- Chat API: `http://localhost:3001`

## Backend interfaces

- `GET /users/:userId` (Bearer token required)
- `GET /rooms/:roomId/messages?limit=50&continuation=...` (Bearer token required)
- `GET /rooms/:roomId/members` (Bearer token required)
- `POST /rooms/:roomId/members` (Bearer token required)

Socket events:

- `register` (token-authenticated socket only)
- `open_room` (returns message history)
- `private_message` (persist then emit)
- `room_message` (persist then emit)
