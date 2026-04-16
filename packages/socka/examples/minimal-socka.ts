/**
 * Minimal runnable example: `bun run example:minimal` from `packages/socka`.
 */
import * as z from "zod";
import {
	defineSocka,
	type InferSockaSend,
	type InferSockaHandlers,
} from "../src/core/contract";

const messageRow = z.object({
	id: z.string(),
	ts: z.number(),
	userId: z.string(),
	displayName: z.string(),
	text: z.string(),
});

const onlineUser = z.object({
	userId: z.string(),
	displayName: z.string(),
});

const contract = defineSocka({
	calls: {
		sendMessage: {
			input: z.object({ text: z.string() }),
			output: z.object({ ok: z.literal(true) }),
		},
		listHistory: {
			input: z.object({ limit: z.number().optional() }),
			output: z.object({ messages: z.array(messageRow) }),
		},
		listPresence: {
			input: z.object({}).optional(),
			output: z.object({
				selfUserId: z.string(),
				users: z.array(onlineUser),
			}),
		},
		clearHistory: {
			input: z.object({}).optional(),
			output: z.object({ ok: z.literal(true) }),
		},
	},
	pushes: {
		userJoined: z.object({ userId: z.string(), displayName: z.string() }),
		userLeft: z.object({
			userId: z.string(),
			displayName: z.string(),
		}),
		roomMessage: z.object({
			id: z.string(),
			ts: z.number(),
			userId: z.string(),
			displayName: z.string(),
			text: z.string(),
		}),
		historyCleared: z.object({
			ts: z.number(),
			clearedByUserId: z.string(),
			clearedByDisplayName: z.string(),
		}),
	},
});

type Send = InferSockaSend<typeof contract>;
type Handlers = InferSockaHandlers<typeof contract, unknown>;

void (async () => {
	const _send: Send = {} as Send;
	const _handlers: Handlers = {
		sendMessage: async () => ({ ok: true }),
		listHistory: async () => ({ messages: [] }),
		listPresence: async () => ({
			selfUserId: "demo-user",
			users: [{ userId: "demo-user", displayName: "Demo" }],
		}),
		clearHistory: async () => ({ ok: true }),
	};
	void _send;
	void _handlers;
	console.log("minimal socka types OK");
})();
