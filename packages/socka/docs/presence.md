# Presence (who is online)

“Presence” is usually modeled as:

1. **Snapshot** — an RPC (e.g. **`listPresence`**) returns the current set of users.
2. **Pushes** — **`userJoined`** / **`userLeft`** (or similar) update the UI when peers attach or detach.

## Server: `listPeers` / `listPeersWith`

On **`SockaWebSocketSession`** (and **`SockaDoSession`**), **`session.listPeers()`** returns **`TData[]`** for every connection in the same **`sessions`** map (same room), in **insert order**. Use **`listPeers({ excludeSelf: true })`** to omit the calling socket.

**`session.peerCount()`** / **`session.hasPeers()`** are cheap alternatives to **`listPeers().length`** when you only need a count or existence check.

**`session.listPeersWith((s) => …)`** maps each **peer session** (not just **`data`**) — useful if you need fields beyond **`TData`**.

Map that list to whatever your RPC output needs:

```ts
listPresence: async (_input, session) => {
	const users = session.listPeers().map((d) => ({
		userId: d.userId,
		displayName: d.displayName,
	}));
	users.sort((a, b) => a.displayName.localeCompare(b.displayName));
	return { selfUserId: session.data.userId, users };
},
```

## Pushes

In **`onAttached`**, broadcast **`userJoined`**; in **`handleClose`**, broadcast **`userLeft`** so other clients update incrementally. Ordering relative to **`listPresence`** is not guaranteed across reconnects — clients should call **`listPresence`** (or equivalent) after connect and treat pushes as deltas.

## Client

After **`waitForOpen()`** or in **`onOpen`**, fetch **`listPresence`** once, then apply **`userJoined`** / **`userLeft`** from **`session.subscribe`** for live updates.

React: **`useSockaPresence`** — see **[Client](./client.md)**.


## See also

- **[Getting started](./getting-started.md)** — chat tutorial.
- **[Pushes](./pushes.md)** — **`broadcastPush`**, **`subscribe`**.
