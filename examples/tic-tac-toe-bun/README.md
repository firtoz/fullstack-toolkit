# Tic-tac-toe (Bun + socka)

Self-contained example: duplicated contract and game logic, [`Bun.serve`](https://bun.sh/docs/api/http#websocket) with WebSocket upgrade on `/ws/:roomId`, and a tiny browser client built with `bun build --target=browser`.

## Run

```bash
bun install
bun run dev
```

Default HTTP port is **3461** (chosen to avoid common dev/test ports in this repo). Open [http://localhost:3461](http://localhost:3461) or set `PORT` when starting the server. Use two tabs with the same room id to play.

## Scripts

- `dev` — build client bundle, then run the server with `--watch`
- `start` — build client, then run once
- `build:client` — emit `public/client.js`
- `typecheck` — `tsgo` over `src/`

See the main [`socka` package README](../../packages/socka/README.md) for API details.
