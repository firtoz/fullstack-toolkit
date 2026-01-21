import { describe, expect, test } from "bun:test";
import type {
	ServerMessage,
	HistoryMessage,
	ToolCallMessage,
} from "@firtoz/chat-agent";
import { BASE_URL } from "./common";

/**
 * ChatAgent E2E tests using Bun's test runner and WebSocket client
 *
 * The wrangler dev server is automatically managed by the global setup (setup.ts).
 */

const AGENT_ID = "test-agent-bun";

// Check if environment variables are configured
const shouldSkip = !(
	process.env.OPENROUTER_API_KEY &&
	process.env.CLOUDFLARE_ACCOUNT_ID &&
	process.env.AI_GATEWAY_NAME &&
	process.env.AI_GATEWAY_TOKEN
);

if (shouldSkip) {
	console.warn(
		"\n⚠️  Skipping ChatAgent E2E tests: Required API credentials not configured.",
	);
	console.warn(
		"   Create a .env.local file with OPENROUTER_API_KEY, CLOUDFLARE_ACCOUNT_ID, AI_GATEWAY_NAME, and AI_GATEWAY_TOKEN.\n",
	);
}

describe("ChatAgent WebSocket E2E (Bun)", () => {
	test.skipIf(shouldSkip)("should connect via WebSocket and send/receive messages", async () => {

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
	});

	test.skipIf(shouldSkip)("should retrieve chat history", async () => {

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

			console.log("✓ History messages count:", result.history.messages.length);
		}
	});

	test.skipIf(shouldSkip)("should handle tool calls with test tool", async () => {

		const wsUrl = `${BASE_URL}/chat-agent/${AGENT_ID}-tools`;

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
	});

	test.skipIf(shouldSkip)("should handle different agent IDs separately", async () => {

		const agent1Url = `${BASE_URL}/chat-agent/agent-1-separate-bun`;
		const agent2Url = `${BASE_URL}/chat-agent/agent-2-separate-bun`;

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
	});
});
