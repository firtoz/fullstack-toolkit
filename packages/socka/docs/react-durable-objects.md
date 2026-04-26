# React + Cloudflare Durable Objects

This page is a **minimal wiring guide** for the common stack: **one shared `defineSocka` contract**, a **Durable Object** extending **`SockaWebSocketDO`**, and a **React** client using **`useSockaSession`**. A full app with routing and persistence is **[chatroom-do](../../examples/chatroom-do)** in this repo.

## Install

You need **`@firtoz/socka`**, **`@firtoz/socka/do`**, **`@firtoz/socka/react`**, and peer deps for Cloudflare and **`@firtoz/websocket-do`**—see **[Peers](./peers.md)** and **[Durable Objects](./durable-objects.md)** (Wrangler, `Env` types, **do not** hand-edit generated worker env `.d.ts` files).

## Shared contract (no client casts)

Export **one** contract from a shared module and import the **same reference** in the worker and the browser. You should **not** need `as never`, `as unknown`, manual `send` types, or `InferSockaSend` in normal app code—if TypeScript widens or fails to infer, align **Zod (or other Standard Schema) output** with any hand-written types (see **[TypeScript and exact optional properties](./reference.md#typescript-and-exact-optional-properties)**) and re-export **types** from the schema with **`z.infer`** when possible.

```ts
// shared/contract.ts
import { defineSocka } from "@firtoz/socka/core";
import { z } from "zod";

export const roomContract = defineSocka({
	calls: {
		list: {
			input: z.object({}).optional(),
			output: z.object({ items: z.array(z.string()) }),
		},
		sendCursor: {
			input: z.object({ x: z.number(), y: z.number() }),
			// no `output` — fire-and-forget; see README “Call `output` shapes”
		},
	},
	pushes: {
		cursorBatch: z.object({
			cursors: z.array(z.object({ x: z.number(), y: z.number() })),
		}),
	},
});
```

**Output shapes** — For high-frequency messages (cursors, live drafts), **omit** `output`. Use **`output: z.void()`** when the client should **await** a server ack. See **[Client — Fire-and-forget](./client.md#fire-and-forget)** and **[Reference — Optional output](./reference.md#optional-output-fire-and-forget)**.

## Durable Object

Subclass **`SockaWebSocketDO`** and return a **`SockaDoSession`** (or subclass) from **`createSockaSession`**. Type your session with **`typeof roomContract`**, not `any` (see **[Durable Objects — Typing `SockaDoSession` in app code](./durable-objects.md#typing-sockadosession-in-app-code)**). Full patterns: **[Durable Objects](./durable-objects.md)**, example **[`examples/chatroom-do/src/do.ts`](../../examples/chatroom-do/src/do.ts)**.

```ts
// do.ts (sketch)
import {
	SockaDoSession,
	SockaWebSocketDO,
	type SockaDoSessionConfig,
} from "@firtoz/socka/do";
import { roomContract } from "./contract";

type SessionData = { userId: string };

export class RoomSockaSession extends SockaDoSession<
	typeof roomContract,
	SessionData,
	Env
> {
	constructor(
		ws: WebSocket,
		sessions: Map<WebSocket, RoomSockaSession>,
		config: SockaDoSessionConfig<typeof roomContract, SessionData, Env>,
	) {
		super(ws, sessions, config);
	}
}

export class RoomDo extends SockaWebSocketDO<RoomSockaSession, Env> {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env, {
			createSockaSession: (_c, ws) =>
				new RoomSockaSession(ws, this.sessions, this.buildConfig()),
		});
	}
	// `buildConfig()` returns SockaDoSessionConfig<typeof roomContract, SessionData, Env>
}
```

## React client

Use **`useSockaSession(contract, { url, pushHandlers? }, deps)`** with the **same** `roomContract` import. For **`pushHandlers`**, you can use **`satisfies Partial<InferSockaPushHandlers<typeof roomContract>>`**—see **[Pushes — Typing `pushHandlers`](./pushes.md#typing-pushhandlers)**.

```tsx
// RoomClient.tsx (sketch; URL must exist before connecting — see Client “SSR and WebSocket URLs”)
import { useSockaSession } from "@firtoz/socka/react";
import { roomContract } from "./contract";

function RoomClient({ url }: { url: string }) {
	const { ready, send } = useSockaSession(
		roomContract,
		{ url, pushHandlers: { cursorBatch: (p) => { /* set state */ } } },
		[url],
	);
	// `await send.list({})` — request/response
	// `void send.sendCursor({ x, y })` — fire-and-forget; see observability in Client + Reference
	return null;
}
```

Whiteboard-style contracts (ops + draft + cursors) are sketched in **[Collaborative realtime](./collaborative-realtime.md)**.

## See also

- **[Client](./client.md)** — `useSockaSession`, **SSR and WebSocket URLs**, fire-and-forget **observability**
- **[Reference](./reference.md)** — `InferSocka*` types, `reportError`, `SockaReportError` kinds
- **[Durable Objects](./durable-objects.md)** — hibernation, `session.update()`, `createData`
- **[chatroom-do](../../examples/chatroom-do)** — SQLite + Drizzle + UI
