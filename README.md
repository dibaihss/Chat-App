# Chat App Monorepo (Next.js + Socket.IO + Cosmos DB)

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

3. Fill Cosmos credentials in `apps/chat-api/.env`.

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

## Implemented backend interfaces

- `GET /users/:userId`
- `GET /rooms/:roomId/messages?limit=50&continuation=...`
- `GET /rooms/:roomId/members`
- `POST /rooms/:roomId/members`

Socket events:

- `register`
- `open_room` (returns message history)
- `private_message` (persist then emit)
- `room_message` (persist then emit)
