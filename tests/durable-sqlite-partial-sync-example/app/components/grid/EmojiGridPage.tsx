import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { BackendSelector } from "../home/BackendSelector";
import type { BackendMode, WsTransport } from "../home/types";
import { IndexedDbEmojiGridClient } from "./IndexedDbEmojiGridClient";
import { MemoryEmojiGridClient } from "./MemoryEmojiGridClient";
import { SqliteEmojiGridClient } from "./SqliteEmojiGridClient";

function getWsTransport(value: string | null): WsTransport {
	return value === "msgpack" ? "msgpack" : "json";
}

function getBackendMode(value: string | null): BackendMode {
	if (value === "indexeddb" || value === "sqlite") return value;
	return "memory";
}

export function EmojiGridPage() {
	const [isMounted, setIsMounted] = useState(false);
	const [topOverlayOpen, setTopOverlayOpen] = useState(true);
	const [searchParams, setSearchParams] = useSearchParams();
	const roomId = searchParams.get("room") ?? "main";
	const wsTransport = getWsTransport(searchParams.get("transport"));
	const backendMode = getBackendMode(searchParams.get("backend"));

	useEffect(() => {
		setIsMounted(true);
	}, []);

	/** Stop horizontal overscroll / swipe from triggering browser history on this route. */
	useEffect(() => {
		if (!isMounted) return;
		const html = document.documentElement;
		const body = document.body;
		const prevHtml = html.style.overscrollBehavior;
		const prevBody = body.style.overscrollBehavior;
		html.style.overscrollBehavior = "none";
		body.style.overscrollBehavior = "none";
		return () => {
			html.style.overscrollBehavior = prevHtml;
			body.style.overscrollBehavior = prevBody;
		};
	}, [isMounted]);

	if (!isMounted) {
		return (
			<div
				style={{
					position: "fixed",
					inset: 0,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					fontFamily: "sans-serif",
				}}
			>
				<p>Loading…</p>
			</div>
		);
	}

	return (
		<div
			style={{
				position: "fixed",
				inset: 0,
				fontFamily: "sans-serif",
				background: "#fafafa",
				overscrollBehavior: "none",
			}}
		>
			<div
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					right: 0,
					zIndex: 30,
					padding: 10,
					pointerEvents: "none",
				}}
			>
				{topOverlayOpen ? (
					<div
						style={{
							pointerEvents: "auto",
							display: "inline-flex",
							flexDirection: "column",
							gap: 8,
							alignItems: "flex-start",
							maxWidth: "min(100%, 440px)",
							padding: "8px 10px",
							borderRadius: 8,
							background: "rgba(255, 255, 255, 0.95)",
							boxShadow: "0 2px 14px rgba(0,0,0,0.1)",
							border: "1px solid rgba(0,0,0,0.06)",
						}}
					>
						<div
							style={{
								display: "flex",
								alignItems: "center",
								justifyContent: "space-between",
								gap: 8,
								width: "100%",
							}}
						>
							<strong style={{ fontSize: 14 }}>Page controls</strong>
							<button
								type="button"
								onClick={() => {
									setTopOverlayOpen(false);
								}}
							>
								Hide
							</button>
						</div>
						<Link
							to={`/?room=${encodeURIComponent(roomId)}&transport=${wsTransport}&backend=${backendMode}`}
						>
							← People list demo
						</Link>
						<div>
							<strong>Emoji grid (2D partial sync)</strong>
							<p style={{ margin: "6px 0 0", fontSize: 13, color: "#333" }}>
								1000 entities in a 1000×1000 world. The map fills the window;
								controls are overlays. Resize the window to change the query
								span.
							</p>
						</div>
						<p style={{ margin: 0, fontSize: 12, color: "#444" }}>
							WebSocket: <code>{wsTransport}</code> · room <code>{roomId}</code>
						</p>
						<label style={{ fontSize: 14, display: "block" }}>
							Transport:{" "}
							<select
								value={wsTransport}
								onChange={(e) => {
									const v = e.target.value as WsTransport;
									setSearchParams(
										(prev) => {
											const next = new URLSearchParams(prev);
											next.set("transport", v);
											return next;
										},
										{ replace: true },
									);
								}}
							>
								<option value="json">json</option>
								<option value="msgpack">msgpack</option>
							</select>
						</label>
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
					</div>
				) : (
					<button
						type="button"
						style={{ pointerEvents: "auto" }}
						onClick={() => {
							setTopOverlayOpen(true);
						}}
					>
						Show page controls
					</button>
				)}
			</div>
			<div style={{ position: "absolute", inset: 0 }}>
				{backendMode === "memory" ? (
					<MemoryEmojiGridClient roomId={roomId} wsTransport={wsTransport} />
				) : backendMode === "indexeddb" ? (
					<IndexedDbEmojiGridClient roomId={roomId} wsTransport={wsTransport} />
				) : (
					<SqliteEmojiGridClient roomId={roomId} wsTransport={wsTransport} />
				)}
			</div>
		</div>
	);
}
