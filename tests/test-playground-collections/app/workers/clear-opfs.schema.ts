import z from "zod";

export enum ClearOpfsClientMessageType {
	Clear = "clear",
	List = "list",
}

export enum ClearOpfsServerMessageType {
	Ready = "ready",
	Cleared = "cleared",
	Listed = "listed",
	Error = "error",
}

export const OpfsEntrySchema = z.object({
	name: z.string(),
	kind: z.enum(["file", "directory"]),
	path: z.string(),
	get children(): z.ZodOptional<z.ZodArray<typeof OpfsEntrySchema>> {
		return z.array(OpfsEntrySchema).optional();
	},
});

export type OpfsEntry = z.infer<typeof OpfsEntrySchema>;

export const ClearOpfsClientMessageSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal(ClearOpfsClientMessageType.Clear),
	}),
	z.object({
		type: z.literal(ClearOpfsClientMessageType.List),
	}),
]);

export const ClearOpfsServerMessageSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal(ClearOpfsServerMessageType.Ready),
	}),
	z.object({
		type: z.literal(ClearOpfsServerMessageType.Cleared),
		count: z.number(),
	}),
	z.object({
		type: z.literal(ClearOpfsServerMessageType.Listed),
		entries: z.array(OpfsEntrySchema),
	}),
	z.object({
		type: z.literal(ClearOpfsServerMessageType.Error),
		error: z.string(),
	}),
]);

export type ClearOpfsClientMessage = z.infer<
	typeof ClearOpfsClientMessageSchema
>;

export type ClearOpfsServerMessage = z.infer<
	typeof ClearOpfsServerMessageSchema
>;
