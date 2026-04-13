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

type Thread = { id: string; title: string };
type Message = { id: string; threadId: string; body: string };

/** Match `VP_SLOW_INSERT_DELAY_MS` in durable-sqlite-sync-example `vp-demo-constants.ts`. */
const DEMO_SLOW_INSERT_MS = 800;

type ThreadQueryUtils = QueryCollectionUtils<Thread, string, Thread>;

export function meta() {
	return [
		{ title: "TanStack DB 0.6 — virtual props & APIs" },
		{
			name: "description",
			content:
				"Query collection, $synced/$origin outbox, createEffect, queryOnce, includes + toArray",
		},
	];
}

/**
 * `useLiveQuery` uses `useSyncExternalStore` without `getServerSnapshot`, so it cannot run
 * during React 19 SSR. Gate the demo until after mount so the server and first hydrated paint match.
 */
export default function Tanstack06VirtualPropsDemo() {
	const [hydrated, setHydrated] = useState(false);
	useEffect(() => {
		setHydrated(true);
	}, []);
	if (!hydrated) {
		return (
			<div style={{ padding: "1rem", maxWidth: 720 }}>
				<p>Loading demo…</p>
			</div>
		);
	}
	return <Tanstack06VirtualPropsDemoClient />;
}

function Tanstack06VirtualPropsDemoClient() {
	const queryClient = useMemo(() => new QueryClient(), []);
	const slowNextInsertRef = useRef(false);
	const serverThreads = useRef<Thread[]>([{ id: "t1", title: "Demo thread" }]);
	const serverMessages = useRef<Message[]>([
		{ id: "m1", threadId: "t1", body: "Seed message (synced)" },
	]);

	const { threads: threadsCollection, messages: messagesCollection } =
		useMemo((): {
			threads: Collection<Thread, string, ThreadQueryUtils>;
			messages: Collection<Message, string, UtilsRecord>;
		} => {
			return {
				threads: createCollection(
					queryCollectionOptions({
						queryKey: ["playground-t6-threads"],
						queryFn: async () => [...serverThreads.current],
						queryClient,
						getKey: (t) => t.id,
					}),
				),
				messages: createCollection(
					queryCollectionOptions({
						queryKey: ["playground-t6-messages"],
						queryFn: async () => [...serverMessages.current],
						queryClient,
						getKey: (m) => m.id,
						// QueryCollectionConfig extends BaseCollectionConfig<T, TKey, TSchema> only — it does
						// not pass TUtils, so onInsert defaults to InsertMutationFn<..., UtilsRecord> and
						// `collection.utils` is typed as Record<string, any>. The *output* of
						// queryCollectionOptions still attaches QueryCollectionUtils; annotate params to match.
						onInsert: async ({
							transaction,
							collection,
						}: InsertMutationFnParams<Message, string, UtilsRecord>) => {
							for (const mut of transaction.mutations) {
								if (mut.type === "insert") {
									const slow = slowNextInsertRef.current;
									slowNextInsertRef.current = false;
									if (slow) {
										await new Promise((r) =>
											setTimeout(r, DEMO_SLOW_INSERT_MS),
										);
									}
									serverMessages.current.push(mut.modified);
								}
							}
							await collection.utils.refetch();
						},
					}),
				),
			};
		}, [queryClient]);

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
		<div style={{ padding: "1rem", maxWidth: 720 }}>
			<h1>TanStack DB 0.6 demo</h1>
			<p>
				<code>@tanstack/query-db-collection</code> + <code>onInsert</code> that
				updates the in-memory server list and refetches. Use{" "}
				<strong>Insert (instant)</strong> or{" "}
				<strong>Insert (slow ~800ms)</strong> to compare how long the row stays
				unsynced. While optimistic, <code>$synced === false</code> and the
				message shows a <strong>Sending…</strong> badge.
			</p>

			<section style={{ marginTop: "1.5rem" }}>
				<h2>Messages (per thread)</h2>
				<p style={{ color: "#444", fontSize: 14 }}>
					Pending: {outbox?.length ?? 0} — unsynced rows show inline with an
					amber edge and badge.
				</p>
				<ul>
					{(tree ?? []).map((t) => (
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
					<button type="button" onClick={() => insertMessage(false)}>
						Insert (instant)
					</button>
					<button type="button" onClick={() => insertMessage(true)}>
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
