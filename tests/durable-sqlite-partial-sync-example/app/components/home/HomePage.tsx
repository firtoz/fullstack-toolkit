import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { BackendSelector } from "./BackendSelector";
import { IndexedDbPeopleClient } from "./IndexedDbPeopleClient";
import { MemoryPeopleClient } from "./MemoryPeopleClient";
import { SqlitePeopleClient } from "./SqlitePeopleClient";
import type { BackendMode, WsTransport } from "./types";

function getBackendMode(value: string | null): BackendMode {
	if (value === "indexeddb" || value === "sqlite") return value;
	return "memory";
}

function getWsTransport(value: string | null): WsTransport {
	return value === "msgpack" ? "msgpack" : "json";
}

export function HomePage() {
	const [isMounted, setIsMounted] = useState(false);
	const [searchParams, setSearchParams] = useSearchParams();
	const backendMode = getBackendMode(searchParams.get("backend"));
	const roomId = searchParams.get("room") ?? "main";
	const wsTransport = getWsTransport(searchParams.get("transport"));

	useEffect(() => {
		setIsMounted(true);
	}, []);

	if (!isMounted) {
		return (
			<div
				style={{ maxWidth: 960, margin: "24px auto", fontFamily: "sans-serif" }}
			>
				<h1>Durable SQLite Partial Sync</h1>
				<p>Loading partial sync client...</p>
			</div>
		);
	}

	return (
		<div
			style={{ maxWidth: 960, margin: "24px auto", fontFamily: "sans-serif" }}
		>
			<h1>Durable SQLite Partial Sync</h1>
			<p>
				Server is authoritative. Client fetches visible ranges only and caches
				as much as possible.
			</p>
			<p style={{ fontSize: 13, color: "#444" }}>
				WebSocket transport: <code>{wsTransport}</code>
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
			{backendMode === "memory" ? (
				<MemoryPeopleClient roomId={roomId} wsTransport={wsTransport} />
			) : backendMode === "indexeddb" ? (
				<IndexedDbPeopleClient roomId={roomId} wsTransport={wsTransport} />
			) : (
				<SqlitePeopleClient roomId={roomId} wsTransport={wsTransport} />
			)}
		</div>
	);
}
