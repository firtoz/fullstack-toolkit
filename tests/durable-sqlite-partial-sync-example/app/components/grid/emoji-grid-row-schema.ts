import { z } from "zod";

/** Zod schema for client-side emoji grid rows (memory / keyval IDB / Drizzle IDB). */
export const emojiGridRowSchema = z.object({
	id: z.string(),
	x: z.number(),
	y: z.number(),
	emoji: z.string(),
	name: z.string(),
	health: z.number(),
	createdAt: z.date(),
	updatedAt: z.date(),
	deletedAt: z.date().nullable(),
});

export type EmojiGridRowVal = z.infer<typeof emojiGridRowSchema>;
