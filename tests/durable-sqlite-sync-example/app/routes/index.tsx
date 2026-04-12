import type { CSSProperties } from "react";
import { Link } from "react-router";

export function meta() {
	return [{ title: "Durable SQLite sync — demos" }];
}

const cardStyle: CSSProperties = {
	border: "1px solid #ccc",
	borderRadius: 8,
	padding: "1rem 1.25rem",
	marginBottom: "1rem",
	maxWidth: 640,
};

export default function DemosIndex() {
	return (
		<div
			style={{ maxWidth: 720, margin: "24px auto", fontFamily: "sans-serif" }}
		>
			<h1>Durable SQLite sync example</h1>
			<p style={{ color: "#444" }}>
				Pick a demo. Each uses the Cloudflare Workers + Durable Object stack in
				this app.
			</p>

			<section style={cardStyle}>
				<h2 style={{ marginTop: 0 }}>
					<Link to="/sync-todos">WebSocket todo sync</Link>
				</h2>
				<p>
					TodoMVC-style UI with optimistic writes; server pushes canonical sync
					over WebSocket. Choose memory, IndexedDB, or SQLite WASM client
					backends.
				</p>
				<p style={{ fontSize: 13, marginBottom: 0 }}>
					<code>/sync-todos</code> — query params:{" "}
					<code>?backend=memory|indexeddb|sqlite</code>, <code>?room=…</code>,{" "}
					<code>?transport=msgpack</code>, <code>?showDeleted=1</code>
				</p>
			</section>

			<section style={cardStyle}>
				<h2 style={{ marginTop: 0 }}>
					<Link to="/virtual-props-do">Virtual props + DO (HTTP)</Link>
				</h2>
				<p>
					Client query collections with <code>$synced</code> /{" "}
					<code>$origin</code>; messages persist via <code>GET/POST</code> on a
					Durable Object. Compare TanStack DO SQLite persistence vs plain
					Drizzle on the same API shape.
				</p>
				<ul style={{ fontSize: 14, marginBottom: 0 }}>
					<li>
						<Link to="/virtual-props-do?backend=tanstack">
							Open with TanStack DO SQLite persistence
						</Link>
					</li>
					<li>
						<Link to="/virtual-props-do?backend=drizzle">
							Open with Drizzle on DO SQLite
						</Link>
					</li>
				</ul>
				<p style={{ fontSize: 13, marginTop: 12, marginBottom: 0 }}>
					<code>/virtual-props-do</code> — optional <code>?room=…</code> for a
					named Durable Object.
				</p>
			</section>

			<section style={cardStyle}>
				<h2 style={{ marginTop: 0 }}>
					<Link to="/virtual-props-do-ws">Virtual props + DO (WebSocket)</Link>
				</h2>
				<p>
					Same client patterns as the HTTP demo, but list/insert go over a
					WebSocket JSON-RPC channel to the Durable Object. Compare TanStack vs
					Drizzle backends.
				</p>
				<ul style={{ fontSize: 14, marginBottom: 0 }}>
					<li>
						<Link to="/virtual-props-do-ws?backend=tanstack">
							Open with TanStack DO SQLite persistence
						</Link>
					</li>
					<li>
						<Link to="/virtual-props-do-ws?backend=drizzle">
							Open with Drizzle on DO SQLite
						</Link>
					</li>
				</ul>
				<p style={{ fontSize: 13, marginTop: 12, marginBottom: 0 }}>
					<code>/virtual-props-do-ws</code> — optional <code>?room=…</code>.
				</p>
			</section>
		</div>
	);
}
