import { DrizzleChatAgent, defineTool } from "@firtoz/chat-agent";

export class TestChatAgent extends DrizzleChatAgent<Env> {
	protected override getSystemPrompt(): string {
		if (this.name.includes("approval")) {
			return [
				"You are an automated E2E harness.",
				"You MUST call the tool `approval_ping` exactly once with arguments `{}`.",
				"Do not answer with plain text only; the test requires a tool call.",
			].join(" ");
		}
		return "You are a helpful test assistant. Keep responses brief.";
	}

	protected override getModel(): string {
		return "anthropic/claude-haiku-4.5"; // Fastest, cheapest for testing ($1/1M input, $5/1M output)
	}

	protected override getTools() {
		/** PartyServer exposes the Durable Object `getByName` id as `Server#name`. */
		const approvalOnlyE2E = this.name.includes("approval");

		const approvalPing = defineTool({
			name: "approval_ping",
			description:
				"E2E-only tool that always requires human approval before execute. Call with an empty object {}.",
			parameters: {
				type: "object",
				properties: {},
			},
			needsApproval: () => true,
			execute: async () => ({ ok: true }),
		});

		if (approvalOnlyE2E) {
			return [approvalPing];
		}

		return [
			defineTool({
				name: "get_test_value",
				description: "Get a test value",
				parameters: {
					type: "object",
					properties: {
						key: {
							type: "string",
							description: "The key to get",
						},
					},
					required: ["key"],
				},
				execute: async (args: { key: string }) => {
					return {
						key: args.key,
						value: `test-value-${args.key}`,
						timestamp: Date.now(),
					};
				},
			}),
			approvalPing,
		];
	}
}
