import { z } from "zod";

/** Shared body for `/demo/randomize-visible` on people + emoji grid DOs. */
export const demoRandomizeVisibleJsonSchema = z.object({
	rowIds: z.array(z.string()).optional(),
});
