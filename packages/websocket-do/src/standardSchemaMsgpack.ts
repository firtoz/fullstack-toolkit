import type { StandardSchemaV1 } from "@standard-schema/spec";
import { pack, unpack } from "msgpackr";
import { parseStandardSchema } from "./parseStandardSchema";

export const standardSchemaMsgpack = <T>(
	schema: StandardSchemaV1<unknown, T>,
) => ({
	async encode(value: T): Promise<Uint8Array> {
		const validated = await parseStandardSchema(schema, value);
		const packed = pack(validated);
		return new Uint8Array(packed);
	},
	async decode(bytes: Uint8Array): Promise<T> {
		const unpacked = unpack(bytes);
		return parseStandardSchema(schema, unpacked);
	},
});
