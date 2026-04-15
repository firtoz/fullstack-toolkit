# Peers

Install **`@firtoz/socka`** first, then add **only** the peers for the code paths you import.

## Pick your flow, then install

Choose one row and install for your app (`npm install`, `pnpm add`, `bun add`, etc.). Adjust versions to match your stack.

### Browser or Vite SPA (client only)

You use **`@firtoz/socka/client`** (and maybe **`@firtoz/socka/core`** for types). No server adapters. **No Cloudflare types required**—standard DOM / `lib` typings are enough for `WebSocket`.

```bash
npm install @firtoz/socka
```

### React client (`@firtoz/socka/react`)

```bash
npm install @firtoz/socka react
```

Add **`@types/react`** as a dev dependency if TypeScript asks for them.

### Node + Hono + `@hono/node-ws` (`@firtoz/socka/hono`)

```bash
npm install @firtoz/socka hono @hono/node-ws @hono/node-server ws
```

Add **`@types/ws`** as a dev dependency when you use the **`ws`** package on Node.

### Bun + `Bun.serve` (`@firtoz/socka/bun`)

```bash
npm install @firtoz/socka
```

Add **`bun-types`** as a dev dependency for TypeScript if you type-check Bun APIs.

### Cloudflare Workers + Hono upgrade (`@firtoz/socka/hono/cloudflare`)

```bash
npm install @firtoz/socka hono @cloudflare/workers-types
```

### Cloudflare Durable Objects (`@firtoz/socka/do`)

```bash
npm install @firtoz/socka hono @firtoz/websocket-do @cloudflare/workers-types
```

**Version pairing:** `@firtoz/socka/do` subclasses **`@firtoz/websocket-do`** (`BaseSession`, `BaseWebSocketDO`). The two packages use **different** version numbers on npm—there is no rule like “same major as socka.” Use a **websocket-do** version that **socka**’s **`peerDependencies`** (and changelog, if you hit edge cases) allow for your **socka** release. You can upgrade **either** package on its own while the integration stays compatible; coordinate when **`BaseSession` / `BaseWebSocketDO`** or socka’s DO layer changes (often **TypeScript** errors first).

### Portable `ws` / `attachSockaWebSocket` only (`@firtoz/socka/server`)

```bash
npm install @firtoz/socka ws
```

Add **`@types/ws`** as a dev dependency when you use **`ws`** on Node. (Omit **`ws`** if your runtime already provides a typed **`WebSocket`**.)

---

`@firtoz/websocket-do` is marked **optional** in **`@firtoz/socka`’s** `package.json` so browser-only clients do not pull Durable Object code. **`@cloudflare/workers-types`** is also **optional** unless you import **`@firtoz/socka/do`** or **`@firtoz/socka/hono/cloudflare`**, where Workers globals are part of the story.

**Any Worker that imports `@firtoz/socka/do` must add `@firtoz/websocket-do` explicitly:** `npm install @firtoz/websocket-do`. Choose a version that **satisfies socka’s stated peer range** (and your app’s lockfile); you do not need one-off “lockstep” bumps for every unrelated release—only when integration or types break.

## Practical notes

- **Only install peers for paths you use.** A Vite SPA that only imports `@firtoz/socka/client` does not need `hono`, **`@cloudflare/workers-types`**, or `@firtoz/websocket-do`.
- **TypeScript:** For Workers code, add **`@cloudflare/workers-types`** to `compilerOptions.types` (or use your framework’s defaults). For **`@firtoz/socka/bun`** handlers, add **`bun-types`** when you author against Bun APIs.
- **socka + websocket-do:** If **`@firtoz/websocket-do`** is **outside** what your **socka** version expects (or websocket-do ships a breaking `BaseSession` / `BaseWebSocketDO` change), you may see **type errors** on `SockaDoSession` / `SockaWebSocketDO` or runtime issues—then bump **one or both** until the pairing in the docs / peer range works again.

## By entrypoint (reference)

| Entry | Required peers | Why |
|--------|----------------|-----|
| `@firtoz/socka/core`, `@firtoz/socka/client` | **None** | Uses Standard Schema, **`WebSocket`**, and shared frame types—**`lib: ["DOM"]`** (or your bundler defaults) is enough. |
| `@firtoz/socka/react` | `react` **≥ 18** | Hooks and provider API. |
| `@firtoz/socka/do` | **`@firtoz/websocket-do`** (version range per **socka** `peerDependencies` / changelog), **`@cloudflare/workers-types`**, **`hono`** | `SockaDoSession` extends **`BaseSession`** from **websocket-do**; **`SockaWebSocketDO`** uses **Hono**-shaped routing on top of **`BaseWebSocketDO`**. |
| `@firtoz/socka/server` | None beyond `@firtoz/socka/core` (standard **`WebSocket`** + same contract types) | Portable **`attachSockaWebSocket`** path. |
| `@firtoz/socka/bun` | Same as `@firtoz/socka/server` (**`bun-types`** for TypeScript) | **`Bun.serve`** / **`ServerWebSocket`** integration. |
| `@firtoz/socka/hono` | **`hono`**, **`@hono/node-ws`**, **`@hono/node-server`**, **`ws`** (runtime + types) | Node **`upgradeWebSocket`** pipeline. |
| `@firtoz/socka/hono/cloudflare` | **`hono`**, **`@cloudflare/workers-types`** (**`upgradeWebSocket`** from `hono/cloudflare-workers`) | Workers WebSocket upgrade (session often starts on first message—see **[Server](./server.md)**). |
