---
"@firtoz/chat-agent-sql": patch
"@firtoz/chat-agent-drizzle": patch
---

Fix **tsup** `.d.ts` generation when **`@firtoz/chat-agent`** is not linked under **`node_modules`** (e.g. **`npm publish`** / **`prepack`** sandboxes): add **`tsconfig` `paths`** to the workspace **`chat-agent`** source so TypeScript resolves imports without a symlink.
