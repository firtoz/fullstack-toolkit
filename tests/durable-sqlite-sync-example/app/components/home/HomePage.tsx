import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { BackendSelector } from "./BackendSelector";
import { IndexedDbTodoClient } from "./IndexedDbTodoClient";
import { MemoryTodoClient } from "./MemoryTodoClient";
import { SqliteTodoClient } from "./SqliteTodoClient";
import type { WsTransport } from "./TodoSyncClient";
import type { BackendMode } from "./types";

function getBackendMode(value: string | null): BackendMode {
	if (value === "indexeddb" || value === "sqlite") return value;
	return "memory";
}

function getShowDeleted(value: string | null): boolean {
	return value === "1" || value === "true";
}

function getWsTransport(value: string | null): WsTransport {
	return value === "msgpack" ? "msgpack" : "json";
}

export function HomePage() {
	const [isMounted, setIsMounted] = useState(false);
	const [searchParams, setSearchParams] = useSearchParams();
	const backendMode = getBackendMode(searchParams.get("backend"));
	const showDeleted = getShowDeleted(searchParams.get("showDeleted"));
	const roomId = searchParams.get("room") ?? "main";
	const wsTransport = getWsTransport(searchParams.get("transport"));

	useEffect(() => {
		setIsMounted(true);
	}, []);

	if (!isMounted) {
		return (
			<div
				style={{ maxWidth: 900, margin: "24px auto", fontFamily: "sans-serif" }}
			>
				<h1>Durable SQLite Sync TodoMVC</h1>
				<p>Loading client sync view...</p>
			</div>
		);
	}

	return (
		<div
			style={{ maxWidth: 900, margin: "24px auto", fontFamily: "sans-serif" }}
		>
			<p style={{ marginBottom: 16 }}>
				<Link to="/">All demos</Link>
			</p>
			<h1>Durable SQLite Sync TodoMVC</h1>
			<p>Client writes are optimistic; server sends canonical sync changes.</p>
			<p style={{ fontSize: 13, color: "#444" }}>
				WebSocket transport: <code>{wsTransport}</code> (use{" "}
				<code>?transport=msgpack</code> for binary msgpack)
			</p>
			<BackendSelector
				backendMode={backendMode}
				onChange={(nextBackend) => {
					setSearchParams(
						(prev) => {
							const next = new URLSearchParams(prev);
							next.set("backend", nextBackend);
							return next;
						},
						{ replace: true },
					);
				}}
			/>
			<label style={{ display: "block", marginTop: 12 }}>
				<input
					type="checkbox"
					checked={showDeleted}
					onChange={(event) => {
						setSearchParams(
							(prev) => {
								const next = new URLSearchParams(prev);
								if (event.target.checked) {
									next.set("showDeleted", "1");
								} else {
									next.delete("showDeleted");
								}
								return next;
							},
							{ replace: true },
						);
					}}
				/>{" "}
				Show deleted
			</label>
			{backendMode === "memory" ? (
				<MemoryTodoClient
					roomId={roomId}
					showDeleted={showDeleted}
					wsTransport={wsTransport}
				/>
			) : backendMode === "indexeddb" ? (
				<IndexedDbTodoClient
					roomId={roomId}
					showDeleted={showDeleted}
					wsTransport={wsTransport}
				/>
			) : (
				<SqliteTodoClient
					roomId={roomId}
					showDeleted={showDeleted}
					wsTransport={wsTransport}
				/>
			)}
		</div>
	);
}
