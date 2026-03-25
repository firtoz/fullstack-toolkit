import { describe, expect, test } from "bun:test";
import {
	ClientMessageSchema,
	ServerMessageSchema,
	defineTool,
	parseClientMessage,
	safeParseClientMessage,
	safeParseServerMessage,
} from "./chat-messages";

const userMsg = (id: string, content: string, createdAt = 1) =>
	({
		id,
		role: "user" as const,
		content,
		createdAt,
	}) as const;

describe("ClientMessageSchema sendMessage", () => {
	test("accepts submit with non-empty content", () => {
		const r = ClientMessageSchema.safeParse({
			type: "sendMessage",
			content: "hello",
		});
		expect(r.success).toBe(true);
	});

	test("rejects submit with no content and no trailing user message", () => {
		const r = ClientMessageSchema.safeParse({
			type: "sendMessage",
		});
		expect(r.success).toBe(false);
	});

	test("rejects submit with empty content and no messages", () => {
		const r = ClientMessageSchema.safeParse({
			type: "sendMessage",
			content: "",
		});
		expect(r.success).toBe(false);
	});

	test("accepts submit with messages ending in user and no content", () => {
		const r = ClientMessageSchema.safeParse({
			type: "sendMessage",
			messages: [userMsg("u1", "hi")],
		});
		expect(r.success).toBe(true);
	});

	test("accepts submit with messages ending in user and empty content", () => {
		const r = ClientMessageSchema.safeParse({
			type: "sendMessage",
			content: "",
			messages: [userMsg("u1", "hi")],
		});
		expect(r.success).toBe(true);
	});

	test("rejects regenerate-message without messages", () => {
		const r = ClientMessageSchema.safeParse({
			type: "sendMessage",
			trigger: "regenerate-message",
		});
		expect(r.success).toBe(false);
	});

	test("rejects regenerate-message with empty messages array", () => {
		const r = ClientMessageSchema.safeParse({
			type: "sendMessage",
			trigger: "regenerate-message",
			messages: [],
		});
		expect(r.success).toBe(false);
	});

	test("accepts regenerate-message with non-empty messages", () => {
		const r = ClientMessageSchema.safeParse({
			type: "sendMessage",
			trigger: "regenerate-message",
			messages: [userMsg("u1", "hi")],
		});
		expect(r.success).toBe(true);
	});
});

describe("toolApprovalResponse", () => {
	test("parses via safeParseClientMessage", () => {
		const json = JSON.stringify({
			type: "toolApprovalResponse",
			approvalId: "a1",
			approved: true,
		});
		expect(safeParseClientMessage(json)).toEqual({
			type: "toolApprovalResponse",
			approvalId: "a1",
			approved: true,
		});
	});

	test("parseClientMessage throws on invalid payload", () => {
		const json = JSON.stringify({
			type: "toolApprovalResponse",
			approvalId: "a1",
		});
		expect(() => parseClientMessage(json)).toThrow();
	});
});

describe("ServerMessageSchema", () => {
	test("parses toolApprovalRequest", () => {
		const raw = {
			type: "toolApprovalRequest",
			approvalId: "ap1",
			toolCallId: "tc1",
			toolName: "approval_ping",
			arguments: "{}",
		};
		const r = ServerMessageSchema.safeParse(raw);
		expect(r.success).toBe(true);
		if (r.success) {
			expect(r.data.type).toBe("toolApprovalRequest");
		}
	});

	test("parses toolCall with providerMetadata", () => {
		const raw = {
			type: "toolCall" as const,
			id: "m1",
			toolCall: {
				id: "call_1",
				type: "function" as const,
				function: { name: "x", arguments: "{}" },
				providerMetadata: { google: { thought: true } },
			},
		};
		const r = ServerMessageSchema.safeParse(raw);
		expect(r.success).toBe(true);
		expect(safeParseServerMessage(JSON.stringify(raw))).toEqual(raw);
	});

	test("parses toolCallDelta with providerMetadata", () => {
		const raw = {
			type: "toolCallDelta" as const,
			id: "m1",
			delta: {
				index: 0,
				id: "call_1",
				type: "function" as const,
				function: { name: "x", arguments: "{}" },
				providerMetadata: { extra: "v" },
			},
		};
		const r = ServerMessageSchema.safeParse(raw);
		expect(r.success).toBe(true);
		expect(safeParseServerMessage(JSON.stringify(raw))).toEqual(raw);
	});
});

describe("defineTool", () => {
	test("passes through needsApproval", () => {
		const needsApproval = async () => true;
		const t = defineTool({
			name: "n",
			description: "d",
			parameters: { type: "object", properties: {} },
			execute: async () => ({}),
			needsApproval,
		});
		expect(t.needsApproval).toBe(needsApproval);
	});
});
