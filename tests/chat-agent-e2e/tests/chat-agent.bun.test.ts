import { describe, expect, test } from "bun:test";
import type {
	HistoryMessage,
	ServerMessage,
	ToolCallMessage,
	UserMessage,
} from "@firtoz/chat-agent";
import { BASE_URL } from "./common";
import { isChatAgentE2eFullyConfigured } from "./e2e-env";

/**
 * ChatAgent E2E tests using Bun's test runner and WebSocket client
 *
 * The wrangler dev server is automatically managed by the global setup (setup.ts).
 */

const RUN_ID = Math.random().toString(36).slice(2, 10);
const agentId = (name: string) => `${name}-${RUN_ID}`;
const AGENT_ID = agentId("test-agent-bun");

// Skip when secrets are missing or still example placeholders (e.g. `.env.local` from template).
const shouldSkip = !isChatAgentE2eFullyConfigured();

if (shouldSkip) {
	console.warn(
		"\n⚠️  Skipping ChatAgent E2E tests: required API credentials missing or still example placeholders.",
	);
	console.warn(
		"   In CI: configure repo/workflow secrets. Locally: set those variables or put them in tests/chat-agent-e2e/.env.local (see .env.local.example); local env files override the shell.\n",
	);
}

/** Bun’s default per-test limit is 5s; `setDefaultTimeout` in preload is not reliably honored in CI. */
const LLM_E2E_TEST_TIMEOUT_MS = 120_000;

describe("ChatAgent WebSocket E2E (Bun)", () => {
	test.skipIf(shouldSkip)(
		"should connect via WebSocket and send/receive messages",
		async () => {
			const wsUrl = `${BASE_URL}/chat-agent/${AGENT_ID}`;
			const messages: ServerMessage[] = [];

			const result = await new Promise<{
				success: boolean;
				messages: ServerMessage[];
			}>((resolve) => {
				const ws = new WebSocket(wsUrl);
				let timeout: Timer;

				ws.onopen = () => {
					ws.send(
						JSON.stringify({
							type: "sendMessage",
							content: "Hello! Please respond with just 'Hi there!'",
						}),
					);

					timeout = setTimeout(() => {
						ws.close();
					}, 30000);
				};

				ws.onmessage = (event) => {
					const data = JSON.parse(event.data as string) as ServerMessage;
					messages.push(data);

					if (data.type === "messageEnd") {
						clearTimeout(timeout);
						ws.close();
					}
				};

				ws.onclose = () => {
					resolve({ success: true, messages });
				};

				ws.onerror = () => {
					clearTimeout(timeout);
					resolve({ success: false, messages });
				};
			});

			expect(result.success).toBe(true);
			expect(result.messages.length).toBeGreaterThan(0);

			const messageTypes = result.messages.map((m) => m.type);
			expect(messageTypes).toContain("messageStart");
			expect(messageTypes).toContain("messageEnd");

			const hasChunks = messageTypes.includes("messageChunk");
			expect(hasChunks).toBeTruthy();

			console.log("✓ Received message types:", messageTypes);
			console.log(
				"✓ Message chunks:",
				result.messages.filter((m) => m.type === "messageChunk"),
			);
		},
		{ timeout: LLM_E2E_TEST_TIMEOUT_MS },
	);

	test.skipIf(shouldSkip)(
		"should retrieve chat history",
		async () => {
			const wsUrl = `${BASE_URL}/chat-agent/${AGENT_ID}`;

			const result = await new Promise<{
				history: HistoryMessage | null;
				error?: string;
			}>((resolve) => {
				const ws = new WebSocket(wsUrl);
				let history: HistoryMessage | null = null;
				const timeout = setTimeout(() => {
					ws.close();
					resolve({ history });
				}, 10000);

				ws.onopen = () => {
					ws.send(JSON.stringify({ type: "getHistory" }));
				};

				ws.onmessage = (event) => {
					const data = JSON.parse(event.data as string) as ServerMessage;
					if (data.type === "history") {
						history = data;
						clearTimeout(timeout);
						ws.close();
					}
				};

				ws.onclose = () => {
					clearTimeout(timeout);
					resolve({ history });
				};

				ws.onerror = (error) => {
					clearTimeout(timeout);
					resolve({ history: null, error: String(error) });
				};
			});

			expect(result.history).toBeTruthy();
			if (result.history) {
				expect(result.history.type).toBe("history");
				expect(Array.isArray(result.history.messages)).toBe(true);
				expect(result.history.messages.length).toBeGreaterThan(0);

				console.log(
					"✓ History messages count:",
					result.history.messages.length,
				);
			}
		},
		{ timeout: LLM_E2E_TEST_TIMEOUT_MS },
	);

	test.skipIf(shouldSkip)(
		"should handle tool calls with test tool",
		async () => {
			const wsUrl = `${BASE_URL}/chat-agent/${agentId("test-agent-bun-tools")}`;

			const result = await new Promise<{
				success: boolean;
				messages: ServerMessage[];
				toolCalls: ToolCallMessage[];
			}>((resolve) => {
				const ws = new WebSocket(wsUrl);
				const messages: ServerMessage[] = [];
				const toolCalls: ToolCallMessage[] = [];
				let timeout: Timer;

				ws.onopen = () => {
					ws.send(
						JSON.stringify({
							type: "sendMessage",
							content: "Please use the get_test_value tool with key 'foo'",
						}),
					);

					timeout = setTimeout(() => ws.close(), 30000);
				};

				ws.onmessage = (event) => {
					const data = JSON.parse(event.data as string) as ServerMessage;
					messages.push(data);

					if (data.type === "toolCall") {
						toolCalls.push(data);
					}

					if (data.type === "messageEnd") {
						clearTimeout(timeout);
						ws.close();
					}
				};

				ws.onclose = () => {
					clearTimeout(timeout);
					resolve({ success: true, messages, toolCalls });
				};

				ws.onerror = () => {
					clearTimeout(timeout);
					resolve({ success: false, messages, toolCalls });
				};
			});

			expect(result.success).toBe(true);
			expect(result.messages.length).toBeGreaterThan(0);

			console.log("✓ Tool calls received:", result.toolCalls.length);
			if (result.toolCalls.length > 0) {
				console.log(
					"✓ Tool call names:",
					result.toolCalls.map((tc) => tc.toolCall.function.name),
				);
			}
		},
		{ timeout: LLM_E2E_TEST_TIMEOUT_MS },
	);

	test.skipIf(shouldSkip)(
		"should handle different agent IDs separately",
		async () => {
			const agent1Url = `${BASE_URL}/chat-agent/${agentId("agent-1-separate-bun")}`;
			const agent2Url = `${BASE_URL}/chat-agent/${agentId("agent-2-separate-bun")}`;

			const sendMessage = (wsUrl: string, content: string) => {
				return new Promise<{ success: boolean }>((resolve) => {
					const ws = new WebSocket(wsUrl);
					const timeout = setTimeout(() => {
						ws.close();
						resolve({ success: false });
					}, 5000);

					ws.onopen = () => {
						ws.send(
							JSON.stringify({
								type: "sendMessage",
								content,
							}),
						);
						setTimeout(() => ws.close(), 3000);
					};

					ws.onclose = () => {
						clearTimeout(timeout);
						resolve({ success: true });
					};

					ws.onerror = () => {
						clearTimeout(timeout);
						resolve({ success: false });
					};
				});
			};

			const [result1, result2] = await Promise.all([
				sendMessage(agent1Url, "Message to agent 1"),
				sendMessage(agent2Url, "Message to agent 2"),
			]);

			expect(result1.success).toBe(true);
			expect(result2.success).toBe(true);
			console.log("✓ Separate agent instances working correctly");
		},
		{ timeout: LLM_E2E_TEST_TIMEOUT_MS },
	);

	test.skipIf(shouldSkip)(
		"should broadcast streaming to a second WebSocket on the same agent",
		async () => {
			const wsUrl = `${BASE_URL}/chat-agent/${agentId("test-agent-broadcast-bun")}`;
			const bTypes: string[] = [];

			await new Promise<void>((resolve, reject) => {
				const wsA = new WebSocket(wsUrl);
				const wsB = new WebSocket(wsUrl);
				let opened = 0;
				let aSawEnd = false;
				let bSawEnd = false;

				const timeout = setTimeout(() => {
					wsA.close();
					wsB.close();
					reject(new Error("timeout waiting for broadcast"));
				}, 45000);

				const tryFinish = () => {
					if (!aSawEnd || !bSawEnd) {
						return;
					}
					clearTimeout(timeout);
					wsA.close();
					wsB.close();
					resolve();
				};

				const onBothOpen = () => {
					if (opened < 2) {
						return;
					}
					wsA.send(
						JSON.stringify({
							type: "sendMessage",
							content: "Reply with a single word: pong",
						}),
					);
				};

				wsA.onopen = () => {
					opened++;
					onBothOpen();
				};
				wsB.onopen = () => {
					opened++;
					onBothOpen();
				};

				wsB.onmessage = (event) => {
					const data = JSON.parse(event.data as string) as ServerMessage;
					bTypes.push(data.type);
					if (data.type === "messageEnd") {
						bSawEnd = true;
						tryFinish();
					}
				};

				wsA.onmessage = (event) => {
					const data = JSON.parse(event.data as string) as ServerMessage;
					if (data.type === "messageEnd") {
						aSawEnd = true;
						tryFinish();
					}
				};

				wsA.onerror = wsB.onerror = () => {
					clearTimeout(timeout);
					reject(new Error("websocket error"));
				};
			});

			expect(bTypes).toContain("messageStart");
			expect(bTypes).toContain("messageEnd");
			expect(bTypes.some((t) => t === "messageChunk")).toBe(true);
			console.log("✓ Tab B observed types:", bTypes);
		},
		{ timeout: LLM_E2E_TEST_TIMEOUT_MS },
	);

	test.skipIf(shouldSkip)(
		"should run approval_ping after client approves toolApprovalRequest",
		async () => {
			const wsUrl = `${BASE_URL}/chat-agent/${agentId("test-agent-approval-bun")}`;
			const collected: ServerMessage[] = [];
			let sawApproval = false;
			let phase: "wait_empty" | "chat" = "wait_empty";

			const result = await new Promise<{
				success: boolean;
				sawApprovalRequest: boolean;
				sawMessageEnd: boolean;
			}>((resolve) => {
				const ws = new WebSocket(wsUrl);
				let timeout: Timer | undefined;

				const armTimeout = () => {
					clearTimeout(timeout);
					timeout = setTimeout(() => {
						ws.close();
						resolve({
							success: false,
							sawApprovalRequest: sawApproval,
							sawMessageEnd: false,
						});
					}, 45000);
				};

				ws.onopen = () => {
					ws.send(JSON.stringify({ type: "clearHistory" }));
				};

				ws.onmessage = (event) => {
					const data = JSON.parse(event.data as string) as ServerMessage;
					collected.push(data);

					if (phase === "wait_empty") {
						if (data.type !== "history") {
							return;
						}
						if (data.messages.length > 0) {
							ws.send(JSON.stringify({ type: "clearHistory" }));
							return;
						}
						phase = "chat";
						ws.send(
							JSON.stringify({
								type: "sendMessage",
								content:
									"You must call the approval_ping tool exactly once with an empty object {}. Do not call get_test_value.",
							}),
						);
						armTimeout();
						return;
					}

					if (data.type === "toolApprovalRequest") {
						sawApproval = true;
						ws.send(
							JSON.stringify({
								type: "toolApprovalResponse",
								approvalId: data.approvalId,
								approved: true,
							}),
						);
					}

					// Server sends messageEnd before toolApprovalRequest; do not close on the first messageEnd.
					if (data.type === "messageEnd" && sawApproval) {
						clearTimeout(timeout);
						ws.close();
					}
				};

				ws.onclose = () => {
					clearTimeout(timeout);
					const sawMessageEnd = collected.some((m) => m.type === "messageEnd");
					resolve({
						success: sawApproval && sawMessageEnd,
						sawApprovalRequest: sawApproval,
						sawMessageEnd,
					});
				};

				ws.onerror = () => {
					clearTimeout(timeout);
					resolve({
						success: false,
						sawApprovalRequest: sawApproval,
						sawMessageEnd: collected.some((m) => m.type === "messageEnd"),
					});
				};
			});

			expect(result.sawApprovalRequest).toBe(true);
			expect(result.sawMessageEnd).toBe(true);
			expect(result.success).toBe(true);
			const names = collected
				.filter((m): m is ToolCallMessage => m.type === "toolCall")
				.map((m) => m.toolCall.function.name);
			expect(names.some((n) => n === "approval_ping")).toBe(true);
			console.log("✓ approval_ping tool calls:", names);
		},
		{ timeout: LLM_E2E_TEST_TIMEOUT_MS },
	);

	test.skipIf(shouldSkip)(
		"should surface toolError when tool approval is rejected",
		async () => {
			const wsUrl = `${BASE_URL}/chat-agent/${agentId("test-agent-approval-reject-bun")}`;
			const collected: ServerMessage[] = [];
			let sawApproval = false;
			let phase: "wait_empty" | "chat" = "wait_empty";

			const result = await new Promise<{
				sawRejectionError: boolean;
				sawMessageEnd: boolean;
			}>((resolve) => {
				const ws = new WebSocket(wsUrl);
				let timeout: Timer | undefined;

				const armTimeout = () => {
					clearTimeout(timeout);
					timeout = setTimeout(() => {
						ws.close();
						resolve({
							sawRejectionError: false,
							sawMessageEnd: false,
						});
					}, 45000);
				};

				ws.onopen = () => {
					ws.send(JSON.stringify({ type: "clearHistory" }));
				};

				ws.onmessage = (event) => {
					const data = JSON.parse(event.data as string) as ServerMessage;
					collected.push(data);

					if (phase === "wait_empty") {
						if (data.type !== "history") {
							return;
						}
						if (data.messages.length > 0) {
							ws.send(JSON.stringify({ type: "clearHistory" }));
							return;
						}
						phase = "chat";
						ws.send(
							JSON.stringify({
								type: "sendMessage",
								content:
									"You must call the approval_ping tool exactly once with {}. Do not call get_test_value.",
							}),
						);
						armTimeout();
						return;
					}

					if (data.type === "toolApprovalRequest") {
						sawApproval = true;
						ws.send(
							JSON.stringify({
								type: "toolApprovalResponse",
								approvalId: data.approvalId,
								approved: false,
							}),
						);
					}

					if (data.type === "messageEnd" && sawApproval) {
						clearTimeout(timeout);
						ws.close();
					}
				};

				ws.onclose = () => {
					clearTimeout(timeout);
					const sawRejectionError = collected.some(
						(m) =>
							m.type === "toolError" &&
							m.errorType === "output" &&
							m.message.includes("rejected"),
					);
					resolve({
						sawRejectionError,
						sawMessageEnd: collected.some((m) => m.type === "messageEnd"),
					});
				};

				ws.onerror = () => {
					clearTimeout(timeout);
					resolve({
						sawRejectionError: collected.some(
							(m) =>
								m.type === "toolError" &&
								m.errorType === "output" &&
								m.message.includes("rejected"),
						),
						sawMessageEnd: collected.some((m) => m.type === "messageEnd"),
					});
				};
			});

			expect(sawApproval).toBe(true);
			expect(result.sawRejectionError).toBe(true);
			expect(result.sawMessageEnd).toBe(true);
			console.log("✓ Rejection toolError observed");
		},
		{ timeout: LLM_E2E_TEST_TIMEOUT_MS },
	);

	test.skipIf(shouldSkip)(
		"should complete regenerate-message after replacing messages from history",
		async () => {
			const wsUrl = `${BASE_URL}/chat-agent/${agentId("test-agent-regenerate-bun")}`;
			const collected: ServerMessage[] = [];
			let stage: "first" | "history" | "regenerating" = "first";

			await new Promise<void>((resolve, reject) => {
				const ws = new WebSocket(wsUrl);
				let timeout: Timer;
				let settled = false;

				const fail = (msg: string) => {
					if (settled) {
						return;
					}
					settled = true;
					clearTimeout(timeout);
					ws.close();
					reject(new Error(msg));
				};

				ws.onopen = () => {
					ws.send(
						JSON.stringify({
							type: "sendMessage",
							content: "Reply with exactly one word: kiwi",
						}),
					);
					timeout = setTimeout(() => fail("timeout in regenerate test"), 60000);
				};

				ws.onmessage = (event) => {
					const data = JSON.parse(event.data as string) as ServerMessage;
					collected.push(data);

					if (data.type === "messageEnd" && stage === "first") {
						stage = "history";
						ws.send(JSON.stringify({ type: "getHistory" }));
						return;
					}

					if (data.type === "history" && stage === "history") {
						let lastUser: UserMessage | undefined;
						for (let i = data.messages.length - 1; i >= 0; i--) {
							const m = data.messages[i];
							if (m.role === "user") {
								lastUser = m;
								break;
							}
						}
						if (!lastUser) {
							fail("no user message in history");
							return;
						}
						stage = "regenerating";
						ws.send(
							JSON.stringify({
								type: "sendMessage",
								trigger: "regenerate-message",
								messages: [lastUser],
							}),
						);
						return;
					}

					if (data.type === "messageEnd" && stage === "regenerating") {
						if (settled) {
							return;
						}
						settled = true;
						clearTimeout(timeout);
						ws.close();
						resolve();
					}
				};

				ws.onclose = () => {
					clearTimeout(timeout);
				};

				ws.onerror = () => {
					fail("websocket error");
				};
			});

			const messageEnds = collected.filter((m) => m.type === "messageEnd");
			expect(messageEnds.length).toBeGreaterThanOrEqual(2);
			console.log(
				"✓ regenerate-message completed (messageEnd count:",
				messageEnds.length,
				")",
			);
		},
		{ timeout: LLM_E2E_TEST_TIMEOUT_MS },
	);
});
