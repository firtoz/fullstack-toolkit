# Peers

Install **socka** first, then add **only** the peers for the code paths you import. Package managers may warn about missing peers until you do—that is expected (see **[README](../README.md#install)**).

## Pick your flow, then install

Choose one row and run the **`bun add`** line for your app. Adjust versions to match your stack; the **[By entrypoint](#by-entrypoint)** table below explains each package.

### Browser or Vite SPA (client only)

You use **`@firtoz/socka/client`** (and maybe **`@firtoz/socka/core`** for types). No server adapters.

```bash
bun add @firtoz/socka @cloudflare/workers-types
```

### React client (`@firtoz/socka/react`)

```bash
bun add @firtoz/socka react @types/react @cloudflare/workers-types
```

### Node + Hono + `@hono/node-ws` (`@firtoz/socka/hono`)

```bash
bun add @firtoz/socka hono @hono/node-ws @hono/node-server ws @types/ws @cloudflare/workers-types
```

### Bun + `Bun.serve` (`@firtoz/socka/bun`)

```bash
bun add @firtoz/socka @cloudflare/workers-types
```

Add **`bun-types`** as a dev dependency for TypeScript if you type-check Bun APIs.

### Cloudflare Workers + Hono upgrade (`@firtoz/socka/hono/cloudflare`)

```bash
bun add @firtoz/socka hono @cloudflare/workers-types
```

### Cloudflare Durable Objects (`@firtoz/socka/do`)

```bash
bun add @firtoz/socka hono @firtoz/websocket-do @cloudflare/workers-types
```

Keep **`@firtoz/websocket-do`** on the **same major** as **socka**.

### Portable `ws` / `attachSockaWebSocket` only (`@firtoz/socka/server`)

```bash
bun add @firtoz/socka ws @types/ws @cloudflare/workers-types
```

(Omit **`ws`** if your runtime already provides a typed **`WebSocket`**.)

---

## By entrypoint

| Entry | Required peers | Why |
|--------|----------------|-----|
| `@firtoz/socka/core`, `@firtoz/socka/client` | `@cloudflare/workers-types` (or your Workers types setup) | Shared types assume a **`WebSocket`** and Workers-flavored globals in several places; browser-only builds still benefit from consistent typings. |
| `@firtoz/socka/react` | `react` **≥ 18** | Hooks and provider API. |
| `@firtoz/socka/do` | **`@firtoz/websocket-do`** (same major as `socka`), `@cloudflare/workers-types`, **`hono`** | `SockaDoSession` extends **`BaseSession`** from **websocket-do**; **`SockaWebSocketDO`** uses **Hono**-shaped routing on top of **`BaseWebSocketDO`**. |
| `@firtoz/socka/server` | None beyond `@firtoz/socka/core` (standard **`WebSocket`** + same contract types) | Portable **`attachSockaWebSocket`** path. |
| `@firtoz/socka/bun` | Same as `@firtoz/socka/server` (**`bun-types`** for TypeScript) | **`Bun.serve`** / **`ServerWebSocket`** integration. |
| `@firtoz/socka/hono` | **`hono`**, **`@hono/node-ws`**, **`@hono/node-server`**, **`ws`** (runtime + types) | Node **`upgradeWebSocket`** pipeline. |
| `@firtoz/socka/hono/cloudflare` | **`hono`** (**`upgradeWebSocket`** from `hono/cloudflare-workers`) | Workers WebSocket upgrade (session often starts on first message—see **[Server](./server.md)**). |

`@firtoz/websocket-do` is marked **optional** in **socka**’s `package.json` so browser-only clients do not pull Durable Object code. **Any Worker that imports `@firtoz/socka/do` must add it explicitly:** `bun add @firtoz/websocket-do` and keep the **major** aligned with the **socka** release you use.

## Practical notes

- **Only install peers for paths you use.** A Vite SPA that only imports `@firtoz/socka/client` does not need `hono` or `@firtoz/websocket-do`.
- **TypeScript:** If your editor still misses types, ensure `compilerOptions.types` (or your framework’s defaults) includes **`@cloudflare/workers-types`** for Workers code and **`bun-types`** when you author **`@firtoz/socka/bun`** handlers.
- **Version skew:** Mismatching **`@firtoz/websocket-do`** with **socka**’s expected API can surface as type errors on `SockaDoSession` / `SockaWebSocketDO`; upgrade both together when bumping majors.
