# Chat App (Next.js + Socket.IO)

This app uses a single Node server to:

- Serve the Next.js frontend
- Handle realtime private chat over Socket.IO

## Run

1. Install dependencies:

```bash
npm install
```

2. Start development mode:

```bash
npm run dev
```

3. Build and run production mode:

```bash
npm run build
npm run start
```

Default app URL: `http://localhost:3000`

## How to test 2-user realtime chat

1. Open `http://localhost:3000` in two browser windows.
2. Login with different usernames (example: `alice` and `bob`).
3. In each window, set `Send to` to the other username.
4. Send messages and verify realtime delivery.
