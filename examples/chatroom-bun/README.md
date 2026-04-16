# Chatroom (Bun + socka + SQLite)

Multi-room WebSocket chat using **`@firtoz/socka`**, **`createSockaBunWebSocketHandlers({ resolveScope })`**, and **`bun:sqlite`** for persisted history (`./data/chat.sqlite`).

## Run

```bash
bun install
bun run dev
```

Open **http://localhost:3464/** (or **`PORT`**). Use **Connect** to open a pane; each pane is a separate **`SockaSession`** to `ws://host/ws/<room>?name=<displayName>`.

## Layout

- `src/contract.ts` — shared Zod contract (RPC + pushes).
- `src/server.ts` — Bun HTTP + WebSocket upgrade, per-room maps, SQLite reads/writes.
- `src/client.ts` — minimal multi-room UI (bundled to `public/client.js`).
