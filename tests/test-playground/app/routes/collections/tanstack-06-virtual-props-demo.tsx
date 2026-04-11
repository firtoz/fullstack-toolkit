import { QueryClient } from "@tanstack/query-core";
import {
	type QueryCollectionUtils,
	queryCollectionOptions,
} from "@tanstack/query-db-collection";
import {
	type Collection,
	type InsertMutationFnParams,
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

type ThreadQueryUtils = QueryCollectionUtils<Thread, string, Thread>;
type MessageQueryUtils = QueryCollectionUtils<Message, string, Message>;

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
	const serverThreads = useRef<Thread[]>([{ id: "t1", title: "Demo thread" }]);
	const serverMessages = useRef<Message[]>([
		{ id: "m1", threadId: "t1", body: "Seed message (synced)" },
	]);

	const { threads: threadsCollection, messages: messagesCollection } =
		useMemo((): {
			threads: Collection<Thread, string, ThreadQueryUtils>;
			messages: Collection<Message, string, MessageQueryUtils>;
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
						}: InsertMutationFnParams<Message, string, MessageQueryUtils>) => {
							await new Promise((r) => setTimeout(r, 800));
							for (const mut of transaction.mutations) {
								if (mut.type === "insert") {
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
						.select(({ m }) => ({ id: m.id, body: m.body })),
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

	const addPendingMessage = () => {
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
				<code>@tanstack/query-db-collection</code> + delayed{" "}
				<code>onInsert</code> so optimistic rows show{" "}
				<code>$synced === false</code> until refetch.
			</p>

			<section style={{ marginTop: "1.5rem" }}>
				<h2>Outbox (live query)</h2>
				<p>Unsynced rows: {outbox?.length ?? 0}</p>
				<ul>
					{(outbox ?? []).map((row) => (
						<li key={row.id}>
							{row.body}{" "}
							<small>
								(synced={String(row.synced)}, origin={row.origin})
							</small>
						</li>
					))}
				</ul>
				<button type="button" onClick={addPendingMessage}>
					Insert message (800ms fake API)
				</button>
			</section>

			<section style={{ marginTop: "1.5rem" }}>
				<h2>Hierarchical projection (includes + toArray)</h2>
				<ul>
					{(tree ?? []).map((t) => (
						<li key={t.id}>
							<strong>{t.title}</strong>
							<ul>
								{t.messages.map((m) => (
									<li key={m.id}>{m.body}</li>
								))}
							</ul>
						</li>
					))}
				</ul>
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
