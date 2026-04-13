# Tic-tac-toe (Hono + socka)

Self-contained example: duplicated contract and game logic, [`@hono/node-server`](https://github.com/honojs/node-server) with [`@hono/node-ws`](https://github.com/honojs/middleware/tree/main/packages/node-ws) and [`sockaHonoNodeWs`](../../packages/socka/src/hono/node-ws.ts), WebSocket route `/ws/:roomId`, and a browser client built with `bun build --target=browser`.

## Run

```bash
bun install
bun run dev
```

Default HTTP port is **3462** (distinct from the Bun and DO examples in this repo). Open [http://localhost:3462](http://localhost:3462) or set `PORT` when starting the server. Use two tabs with the same room id to play.

## Scripts

- `dev` — build `public/client.js`, then run the server with `--watch`
- `start` — build client, then run once
- `build:client` — emit `public/client.js`
- `typecheck` — `tsgo` over `src/`

See the main [`socka` package README](../../packages/socka/README.md) for API details.
