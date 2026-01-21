import { DrizzleChatAgent, defineTool } from "@firtoz/chat-agent";

export class TestChatAgent extends DrizzleChatAgent<Env> {
	protected override getSystemPrompt(): string {
		return "You are a helpful test assistant. Keep responses brief.";
	}

	protected override getModel(): string {
		return "anthropic/claude-haiku-4.5"; // Fastest, cheapest for testing ($1/1M input, $5/1M output)
	}

	protected override getTools() {
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
		];
	}
}
