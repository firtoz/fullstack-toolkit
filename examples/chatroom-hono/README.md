# Chatroom (Hono + socka + JSON files)

Same **`chatContract`** as **chatroom-bun**, but history is stored as **`./data/<encoded-room>.json`** (one array per room).

## Run

```bash
bun install
bun run dev
```

Open **http://localhost:3465/** (or **`PORT`**).
