import { describe, expect, it } from "bun:test";
import {
	clientMessageSchema,
	serverMessageSchema,
	toSyncMessage,
} from "./sync-protocol";

describe("sync protocol schemas", () => {
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
});
