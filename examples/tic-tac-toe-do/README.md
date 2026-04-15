# Tic-tac-toe (Cloudflare Durable Objects + socka)

Self-contained example: duplicated contract and game logic, a **worker** that routes `GET /ws/:roomId` (WebSocket upgrade) to a **Durable Object** stub per room (`idFromName(roomId)`), and a browser client built with `bun build --target=browser`.

The DO extends [`SockaWebSocketDO`](../../packages/socka/src/do/SockaWebSocketDO.ts); game state lives on the DO instance (two players per room).

**Wrangler / bindings / typegen** — Follow the **[Cloudflare Worker checklist](../../packages/socka/docs/durable-objects.md#cloudflare-worker-checklist)** in the socka docs (same steps this example uses: `wrangler dev`, `cf-typegen`, DO binding).

## Run

```bash
bun install
bun run dev
```

[`wrangler dev`](https://developers.cloudflare.com/workers/wrangler/commands/#dev) is pinned to port **3463** in the `dev` script (avoids clashing with this repo’s chat-agent e2e defaults **8787** / **8791** and the other tic-tac-toe examples). Open [http://localhost:3463](http://localhost:3463). Use two tabs with the same room id to play.

## Scripts

- `dev` — build `public/client.js`, then `wrangler dev`
- `build:client` — emit `public/client.js`
- `typecheck` — `tsgo` over worker/DO sources (`tsconfig.cloudflare.json`)
- `typegen` / `cf-typegen` — regenerate `worker-configuration.d.ts` after changing `wrangler.jsonc` or bindings (see [`@firtoz/worker-helper`](../../packages/worker-helper)); **do not hand-edit** the generated env file.

See [`socka`](../../packages/socka/README.md), **[Getting started](../../packages/socka/docs/getting-started.md)** (pick your stack), and the [documentation hub](../../packages/socka/docs/README.md).
