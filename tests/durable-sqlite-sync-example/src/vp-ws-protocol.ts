import { defineSocka } from "@firtoz/socka/core";
import * as z from "zod";

export const vpMessageSchema = z.object({
	id: z.string(),
	threadId: z.string(),
	body: z.string(),
});

export type VpMessage = z.infer<typeof vpMessageSchema>;

export const vpContract = defineSocka({
	calls: {
		list: {
			output: z.array(vpMessageSchema),
		},
		insert: {
			input: z.object({
				message: vpMessageSchema,
				slow: z.boolean().optional(),
			}),
			output: z.void(),
		},
	},
});

export type VpWsHandlerDeps = {
	listMessages: () => Promise<VpMessage[]>;
	insertMessage: (m: VpMessage) => Promise<void>;
};
