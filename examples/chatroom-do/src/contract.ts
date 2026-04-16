import { defineSocka } from "@firtoz/socka/core";
import * as z from "zod";

export const messageRow = z.object({
	id: z.string(),
	ts: z.number(),
	userId: z.string(),
	displayName: z.string(),
	text: z.string(),
});

export type ChatMessageRow = z.infer<typeof messageRow>;

const onlineUser = z.object({
	userId: z.string(),
	displayName: z.string(),
});

export const chatContract = defineSocka({
	calls: {
		listHistory: {
			input: z.object({ limit: z.number().int().min(1).max(500).optional() }),
			output: z.object({ messages: z.array(messageRow) }),
		},
		listPresence: {
			input: z.object({}).optional(),
			output: z.object({
				selfUserId: z.string(),
				users: z.array(onlineUser),
			}),
		},
		sendMessage: {
			input: z.object({ text: z.string().min(1) }),
			output: z.object({ ok: z.literal(true) }),
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
		roomMessage: messageRow,
		historyCleared: z.object({
			ts: z.number(),
			clearedByUserId: z.string(),
			clearedByDisplayName: z.string(),
		}),
	},
});
