import { exhaustiveGuard } from "@firtoz/maybe-error";
import * as z from "zod";
import { VP_SLOW_INSERT_DELAY_MS } from "./vp-demo-constants";

export const vpMessageSchema = z.object({
	id: z.string(),
	threadId: z.string(),
	body: z.string(),
});

export type VpMessage = z.infer<typeof vpMessageSchema>;

export const vpWsClientMessageSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("list"),
		id: z.string(),
	}),
	z.object({
		type: z.literal("insert"),
		id: z.string(),
		message: vpMessageSchema,
		slow: z.boolean().optional(),
	}),
]);

export type VpWsClientMsg = z.infer<typeof vpWsClientMessageSchema>;

export const vpWsServerMessageSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("listResult"),
		id: z.string(),
		messages: z.array(vpMessageSchema),
	}),
	z.object({
		type: z.literal("insertOk"),
		id: z.string(),
	}),
	z.object({
		type: z.literal("error"),
		id: z.string(),
		error: z.string(),
	}),
]);

export type VpWsServerMsg = z.infer<typeof vpWsServerMessageSchema>;

export type VpWsHandlerDeps = {
	listMessages: () => Promise<VpMessage[]>;
	insertMessage: (m: VpMessage) => Promise<void>;
};

export async function handleVpWsClientMsg(
	msg: VpWsClientMsg,
	deps: VpWsHandlerDeps,
): Promise<VpWsServerMsg> {
	switch (msg.type) {
		case "list": {
			const messages = await deps.listMessages();
			return { type: "listResult", id: msg.id, messages };
		}
		case "insert": {
			const delayMs = msg.slow === true ? VP_SLOW_INSERT_DELAY_MS : 0;
			await new Promise((r) => setTimeout(r, delayMs));
			await deps.insertMessage(msg.message);
			return { type: "insertOk", id: msg.id };
		}
		default:
			exhaustiveGuard(msg);
	}
}
