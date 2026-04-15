import type { StandardSchemaV1 } from "@standard-schema/spec";
import { describe, expect, test } from "bun:test";
import * as v from "valibot";
import * as z from "zod";
import { parseStandardSchema } from "./validate";

const sample = { type: "ping" as const, id: "rpc-1" };

describe("parseStandardSchema", () => {
	test("accepts valid input via Zod (native Standard Schema)", async () => {
		const schema = z.object({
			type: z.literal("ping"),
			id: z.string(),
		});
		await expect(parseStandardSchema(schema, sample)).resolves.toEqual(sample);
	});

	test("rejects invalid input via Zod", async () => {
		const schema = z.object({
			type: z.literal("ping"),
			id: z.string(),
		});
		await expect(
			parseStandardSchema(schema, { type: "nope", id: "x" }),
		).rejects.toThrow();
	});

	test("accepts valid input via Valibot (native Standard Schema)", async () => {
		const schema = v.object({
			type: v.literal("ping"),
			id: v.string(),
		});
		await expect(parseStandardSchema(schema, sample)).resolves.toEqual(sample);
	});

	test("rejects invalid input via Valibot", async () => {
		const schema = v.object({
			type: v.literal("ping"),
			id: v.string(),
		});
		await expect(
			parseStandardSchema(schema, { type: "nope", id: "x" }),
		).rejects.toThrow();
	});

	test("accepts a plain Standard Schema v1 object (no library)", async () => {
		const schema: StandardSchemaV1<unknown, { type: string; id: string }> = {
			"~standard": {
				version: 1,
				vendor: "test-stub",
				validate: (value: unknown) => {
					if (
						value &&
						typeof value === "object" &&
						"type" in value &&
						typeof (value as { type: unknown }).type === "string" &&
						"id" in value &&
						typeof (value as { id: unknown }).id === "string"
					) {
						return {
							value: value as { type: string; id: string },
						};
					}
					return { issues: [{ message: "invalid", path: [] }] };
				},
			},
		};
		await expect(
			parseStandardSchema(schema, { type: "ping", id: "1" }),
		).resolves.toEqual({ type: "ping", id: "1" });
	});
});
