import { QueryClient } from "@tanstack/query-core";
import {
	type QueryCollectionUtils,
	queryCollectionOptions,
} from "@tanstack/query-db-collection";
import {
	type Collection,
	type InsertMutationFnParams,
	type UtilsRecord,
	createCollection,
	createEffect,
	eq,
	queryOnce,
	toArray,
} from "@tanstack/db";
import { useLiveQuery } from "@tanstack/react-db";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import type { VpMessage } from "../../../src/vp-ws-protocol";
import { useVpWsSockaRpc } from "../../../src/vp-ws-rpc-client";
import {
	sortVpMessageRowsForDisplay,
	sortVpMessagesForDisplay,
} from "../../../src/vp-message-sort";

type Thread = { id: string; title: string };

type Message = VpMessage;

type ThreadQueryUtils = QueryCollectionUtils<Thread, string, Thread>;

export type VirtualPropsWsBackend = "tanstack" | "drizzle";

/** Browser-only: call from `useEffect`, not during SSR render. */
function buildWsMessagesUrl(
	roomId: string,
	backend: VirtualPropsWsBackend,
): string {
	const path =
		backend === "tanstack"
			? `/vp/ws-ts/${roomId}/websocket`
			: `/vp/ws-drizzle/${roomId}/websocket`;
	const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
	return `${proto}//${window.location.host}${path}`;
}

export function VirtualPropsDoWsDemoClient() {
	const [searchParams] = useSearchParams();
	const roomId = searchParams.get("room") ?? "main";
	const backendParam = searchParams.get("backend");
	const backend: VirtualPropsWsBackend =
		backendParam === "drizzle" ? "drizzle" : "tanstack";

	const queryClient = useMemo(() => new QueryClient(), []);
	const serverThreads = useRef<Thread[]>([{ id: "t1", title: "Demo thread" }]);
	const serverMessages = useRef<Message[]>([]);

	const slowNextInsertRef = useRef(false);

	const { ready: wsReady, rpc } = useVpWsSockaRpc(
		{
			url: buildWsMessagesUrl(roomId, backend),
		},
		[roomId, backend],
	);

	const messagesQueryKey = useMemo(
		() => [`vp-do-ws-messages-${backend}-${roomId}`] as const,
		[backend, roomId],
	);

	const { threads: threadsCollection, messages: messagesCollection } =
		useMemo((): {
			threads: Collection<Thread, string, ThreadQueryUtils>;
			messages: Collection<Message, string, UtilsRecord>;
		} => {
			return {
				threads: createCollection(
					queryCollectionOptions({
						queryKey: [`vp-do-ws-threads-${roomId}`],
						queryFn: async () => [...serverThreads.current],
						queryClient,
						getKey: (t) => t.id,
					}),
				),
				messages: createCollection(
					queryCollectionOptions({
						queryKey: [...messagesQueryKey],
						enabled: wsReady,
						queryFn: async () => {
							const list = await rpc.list();
							serverMessages.current = list;
							return sortVpMessagesForDisplay([...list]);
						},
						queryClient,
						getKey: (m) => m.id,
						onInsert: async ({
							transaction,
						}: InsertMutationFnParams<Message, string, UtilsRecord>) => {
							const inserted: Message[] = [];
							for (const mut of transaction.mutations) {
								if (mut.type === "insert") {
								const slow = slowNextInsertRef.current;
								slowNextInsertRef.current = false;
								await rpc.insert({ message: mut.modified, slow });
									inserted.push(mut.modified);
								}
							}
							queryClient.setQueryData([...messagesQueryKey], (prev) => {
								const base = Array.isArray(prev) ? [...prev] : [];
								for (const row of inserted) {
									const i = base.findIndex((x) => x.id === row.id);
									if (i === -1) {
										base.push(row);
									} else {
										base[i] = row;
									}
								}
								return sortVpMessagesForDisplay(base);
							});
							return { refetch: false as const };
						},
					}),
				),
			};
		}, [
			queryClient,
			roomId,
			backend,
			wsReady,
			messagesQueryKey,
			rpc,
		]);

	const [queryOnceLabel, setQueryOnceLabel] = useState<string>("");
	const [effectLines, setEffectLines] = useState<string[]>([]);

	const { data: tree } = useLiveQuery(
		(q) =>
			q.from({ t: threadsCollection }).select(({ t }) => ({
				id: t.id,
				title: t.title,
				messages: toArray(
					q
						.from({ m: messagesCollection })
						.where(({ m }) => eq(m.threadId, t.id))
						.select(({ m }) => ({
							id: m.id,
							body: m.body,
							synced: m.$synced,
							origin: m.$origin,
						})),
				),
			})),
		[threadsCollection, messagesCollection],
	);

	const displayTree = useMemo(() => {
		if (!tree) return tree;
		return tree.map((t) => ({
			...t,
			messages: sortVpMessageRowsForDisplay(t.messages),
		}));
	}, [tree]);

	const { data: outbox } = useLiveQuery(
		(q) =>
			q
				.from({ m: messagesCollection })
				.where(({ m }) => eq(m.$synced, false))
				.select(({ m }) => ({
					id: m.id,
					body: m.body,
					synced: m.$synced,
					origin: m.$origin,
				})),
		[messagesCollection],
	);

	useEffect(() => {
		const effect = createEffect({
			query: (q) =>
				q
					.from({ m: messagesCollection })
					.where(({ m }) => eq(m.$synced, false)),
			skipInitial: true,
			onEnter: (event) => {
				const row = event.value as Message & { id: string };
				setEffectLines((prev) => [
					...prev,
					`onEnter unsynced row id=${String(row.id)}`,
				]);
			},
		});
		return () => {
			void effect.dispose();
		};
	}, [messagesCollection]);

	const insertMessage = (slow: boolean) => {
		slowNextInsertRef.current = slow;
		void messagesCollection.insert({
			id: crypto.randomUUID(),
			threadId: "t1",
			body: `New message ${new Date().toISOString()}`,
		});
	};

	const runQueryOnce = async () => {
		const rows = await queryOnce((q) =>
			q.from({ m: messagesCollection }).select(({ m }) => ({ id: m.id })),
		);
		setQueryOnceLabel(`queryOnce → ${rows.length} row(s)`);
	};

	return (
		<div style={{ padding: "1rem", maxWidth: 720, fontFamily: "sans-serif" }}>
			<p style={{ marginBottom: 16 }}>
				<Link to="/">All demos</Link>
				{" · "}
				<Link to="/sync-todos">WebSocket todo sync</Link>
				{" · "}
				<Link
					to={`/virtual-props-do?${new URLSearchParams({ room: roomId, backend }).toString()}`}
				>
					Same demo over HTTP
				</Link>
			</p>
			<h1>Virtual props + Durable Object (WebSocket)</h1>
			<p>
				Room <code>{roomId}</code>, backend{" "}
				<code>
					{backend === "tanstack" ? "TanStack DO SQLite" : "Drizzle DO SQLite"}
				</code>
				. WebSocket: <code>{wsReady ? "connected" : "connecting…"}</code>
			</p>
			<p>
				Switch:{" "}
				<Link
					to={`/virtual-props-do-ws?${new URLSearchParams({ room: roomId, backend: "tanstack" }).toString()}`}
				>
					TanStack
				</Link>
				{" · "}
				<Link
					to={`/virtual-props-do-ws?${new URLSearchParams({ room: roomId, backend: "drizzle" }).toString()}`}
				>
					Drizzle
				</Link>
				.
			</p>
			<p>
				<code>@tanstack/query-db-collection</code> loads via JSON-RPC over a
				WebSocket to the DO; inserts are instant by default, or the server waits
				~800ms when you use <strong>Insert (slow ~800ms)</strong>, then{" "}
				<code>refetch</code> clears <code>$synced</code>. Unsynced rows stay in
				the list below with a <strong>Sending…</strong> badge.
			</p>

			<section style={{ marginTop: "1.5rem" }}>
				<h2>Messages (per thread)</h2>
				<p style={{ color: "#444", fontSize: 14 }}>
					Pending: {outbox?.length ?? 0} — unsynced rows show inline with an
					amber edge and badge.
				</p>
				<ul>
					{(displayTree ?? []).map((t) => (
						<li key={t.id}>
							<strong>{t.title}</strong>
							<ul>
								{t.messages.map((m) => (
									<li
										key={m.id}
										style={
											m.synced === false
												? {
														borderLeft: "3px solid #d97706",
														paddingLeft: 10,
														marginBottom: 6,
													}
												: { marginBottom: 6 }
										}
									>
										{m.body}
										{m.synced === false ? (
											<span
												style={{
													marginLeft: 8,
													fontSize: 12,
													fontWeight: 700,
													color: "#b45309",
												}}
											>
												Sending…
											</span>
										) : null}
										{m.synced === false ? (
											<span
												style={{
													marginLeft: 6,
													fontSize: 11,
													color: "#64748b",
												}}
											>
												(origin={String(m.origin)})
											</span>
										) : null}
									</li>
								))}
							</ul>
						</li>
					))}
				</ul>
				<div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
					<button
						type="button"
						onClick={() => insertMessage(false)}
						disabled={!wsReady}
					>
						Insert (instant)
					</button>
					<button
						type="button"
						onClick={() => insertMessage(true)}
						disabled={!wsReady}
					>
						Insert (slow ~800ms)
					</button>
				</div>
			</section>

			<section style={{ marginTop: "1.5rem" }}>
				<h2>queryOnce</h2>
				<button type="button" onClick={() => void runQueryOnce()}>
					Run queryOnce (all message ids)
				</button>
				{queryOnceLabel ? <p>{queryOnceLabel}</p> : null}
			</section>

			<section style={{ marginTop: "1.5rem" }}>
				<h2>createEffect (unsynced only)</h2>
				<ul>
					{effectLines.map((line, i) => (
						<li key={i}>{line}</li>
					))}
				</ul>
			</section>
		</div>
	);
}
