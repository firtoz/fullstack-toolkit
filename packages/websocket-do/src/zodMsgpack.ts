import { pack, unpack } from "msgpackr";
import type { ZodType } from "zod";

export const zodMsgpack = <T>(schema: ZodType<T>) => ({
	encode(value: T): Uint8Array {
		const validated = schema.parse(value);
		const packed = pack(validated);
		return new Uint8Array(packed);
	},
	decode(bytes: Uint8Array): T {
		return schema.parse(unpack(bytes));
	},
});
