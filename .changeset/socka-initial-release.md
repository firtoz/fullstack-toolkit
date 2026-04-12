---
"socka": minor
---

Initial release of **socka**: Standard Schema-first WebSocket RPC for browsers and Cloudflare Durable Objects.

- **`socka/core`**: `defineSocka` contract API with full type inference (`InferSockaRpc`, `InferSockaHandlers`, `InferSockaEventHandlers`), socka v1 wire envelopes, `SockaError`, `SockaWireError`.
- **`socka/client`**: `SockaRpc` with typed RPC methods generated from the contract, `SockaWebSocketClient`.
- **`socka/react`**: `useSockaRpc(contract, options, deps)` hook returning typed `rpc` object.
- **`socka/do`**: `SockaDoSession` with contract-driven dispatch and typed handler map, `SockaWebSocketDO`.
- **Wire encoding**: default JSON text frames; optional `wireFormat: "msgpack"` on client and DO session for binary frames (same socka v1 object graph via `msgpackr`).
- No schema-library adapters needed — Zod, Valibot, ArkType, or any Standard Schema v1 library works directly.
