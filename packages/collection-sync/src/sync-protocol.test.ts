import { describe, expect, it } from "bun:test";
import {
	clientMessageSchema,
	serverMessageSchema,
	toSyncMessage,
} from "./sync-protocol";

describe("sync protocol schemas", () => {
	it("parses queryByOffset messages", () => {
		const parsed = clientMessageSchema.parse({
			type: "queryByOffset",
			clientId: "client-1",
			requestId: "r1",
			sort: { column: "name", direction: "asc" },
			limit: 50,
			offset: 90000,
		});
		expect(parsed.type).toBe("queryByOffset");
		if (parsed.type === "queryByOffset") {
			expect(parsed.offset).toBe(90000);
		}
	});

	it("parses mutate batch messages", () => {
		const parsed = clientMessageSchema.parse({
			type: "mutateBatch",
			clientId: "client-1",
			mutations: [
				{
					clientMutationId: "m1",
					type: "insert",
					value: { id: "a" },
				},
			],
		});
		expect(parsed.type).toBe("mutateBatch");
	});

	it("parses ack server messages", () => {
		const parsed = serverMessageSchema.parse({
			type: "ack",
			clientId: "client-1",
			clientMutationIds: ["m1"],
			serverVersion: 1,
			changes: [{ type: "truncate" }],
		});
		expect(parsed.type).toBe("ack");
	});

	it("converts update intent into sync message", () => {
		const result = toSyncMessage({
			clientMutationId: "m1",
			type: "update",
			value: { id: "a", done: true },
			previousValue: { id: "a", done: false },
		});
		expect(result.type).toBe("update");
	});

	it("parses syncBackfill with mode", () => {
		const parsed = serverMessageSchema.parse({
			type: "syncBackfill",
			mode: "snapshot",
			serverVersion: 1,
			changes: [],
		});
		expect(parsed.type).toBe("syncBackfill");
		if (parsed.type === "syncBackfill") {
			expect(parsed.mode).toBe("snapshot");
		}
	});

	it("parses rangeQuery index offset with optional fingerprint", () => {
		const parsed = clientMessageSchema.parse({
			type: "rangeQuery",
			clientId: "c1",
			requestId: "r1",
			range: {
				kind: "index",
				mode: "offset",
				sort: { column: "name", direction: "asc" },
				limit: 50,
				offset: 90000,
			},
			fingerprint: { version: 1_700_000_000_000, count: 50 },
		});
		expect(parsed.type).toBe("rangeQuery");
		if (parsed.type === "rangeQuery") {
			expect(parsed.range.kind).toBe("index");
			if (parsed.range.kind === "index") {
				expect(parsed.range.mode).toBe("offset");
				if (parsed.range.mode === "offset") {
					expect(parsed.range.offset).toBe(90000);
				}
			}
			expect(parsed.fingerprint?.count).toBe(50);
		}
	});

	it("parses rangeQuery predicate range", () => {
		const parsed = clientMessageSchema.parse({
			type: "rangeQuery",
			clientId: "c1",
			requestId: "r2",
			range: {
				kind: "predicate",
				conditions: [{ column: "age", op: "gte", value: 18 }],
				sort: { column: "age", direction: "desc" },
				limit: 20,
			},
		});
		expect(parsed.type).toBe("rangeQuery");
		if (parsed.type === "rangeQuery" && parsed.range.kind === "predicate") {
			expect(parsed.range.conditions[0]?.op).toBe("gte");
		}
	});

	it("parses rangeUpToDate and rangeDelta server messages", () => {
		const up = serverMessageSchema.parse({
			type: "rangeUpToDate",
			requestId: "r1",
			totalCount: 100_000,
		});
		expect(up.type).toBe("rangeUpToDate");

		const delta = serverMessageSchema.parse({
			type: "rangeDelta",
			requestId: "r2",
			totalCount: 100_000,
			changes: [{ type: "delete", key: "abc" }],
			lastCursor: null,
		});
		expect(delta.type).toBe("rangeDelta");
		if (delta.type === "rangeDelta") {
			expect(delta.changes.length).toBe(1);
		}
	});

	it("parses rangePatch with optional viewTransition", () => {
		const patch = serverMessageSchema.parse({
			type: "rangePatch",
			change: {
				type: "update",
				value: { id: "1", x: 2 },
				previousValue: { id: "1", x: 1 },
			},
			viewTransition: "exitView",
		});
		expect(patch.type).toBe("rangePatch");
		if (patch.type === "rangePatch") {
			expect(patch.viewTransition).toBe("exitView");
		}
	});

	it("parses rangeReconcile client message and rangeReconcileResult server message", () => {
		const parsed = clientMessageSchema.parse({
			type: "rangeReconcile",
			clientId: "c1",
			requestId: "rc1",
			range: {
				kind: "predicate",
				conditions: [{ column: "x", op: "gte", value: 0 }],
				limit: 50,
			},
			manifest: [
				{ id: "a", version: 10 },
				{ id: 2, version: 20 },
			],
		});
		expect(parsed.type).toBe("rangeReconcile");
		if (parsed.type === "rangeReconcile") {
			expect(parsed.manifest.length).toBe(2);
		}

		const res = serverMessageSchema.parse({
			type: "rangeReconcileResult",
			requestId: "rc1",
			added: [{ type: "insert", value: { id: "3", updatedAt: 1 } }],
			updated: [],
			stale: ["z"],
			movedHints: [{ id: "z", hint: { x: 9 } }],
			totalCount: 100,
		});
		expect(res.type).toBe("rangeReconcileResult");
		if (res.type === "rangeReconcileResult") {
			expect(res.movedHints[0]?.hint.x).toBe(9);
		}
	});
});
