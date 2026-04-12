import type { StandardSchemaV1 } from "@standard-schema/spec";
import { z } from "zod";

const testSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("a"),
		a: z.string(),
	}),
	z.object({
		type: z.literal("b"),
		b: z.string(),
	}),
]);

const testFunction = async <TInput, TOutput>(
	schema: StandardSchemaV1<TInput, TOutput>,
	input: TInput,
): Promise<TOutput> => {
	const result = await schema["~standard"].validate(input);

	if (result.issues) {
		throw new Error(result.issues.map((issue) => issue.message).join(", "));
	}

	return result.value;
};

const result = await testFunction(testSchema, { type: "a", a: "test" });
switch (result.type) {
	case "a":
		console.log(result.a);
		break;
	case "b":
		console.log(result.b);
		break;
	default:
		throw new Error("Invalid type");
}

// (property) StandardJSONSchemaV1<Input = unknown, Output = Input>.Props<{ type: "a"; a: string; } | { type: "b"; b: string; }, { type: "a"; a: string; } | { type: "b"; b: string; }>.jsonSchema: StandardJSONSchemaV1.Converter
testSchema["~standard"].jsonSchema;

/*(property) StandardTypedV1<Input = unknown, Output = Input>.Props<{ type: "a"; a: string; } | { type: "b"; b: string; }, { type: "a"; a: string; } | { type: "b"; b: string; }>.types?: StandardTypedV1.Types<{
    type: "a";
    a: string;
} | {
    type: "b";
    b: string;
}, {
    type: "a";
    a: string;
} | {
    type: "b";
    b: string;
}> | undefined
Inferred types associated with the schema.*/
testSchema["~standard"].types;

type SomeItem = {
	name: string;
	id: string;
	age: number;
};

const _pushHandler = {
	itemsChanged: async (items: SomeItem[]) => {
		console.log(items);

		return true;
	},
};
void _pushHandler;

z.object({
	type: z.literal("a"),
	a: z.string(),
}).optional();
z.void();

const MyFunction = z.function({
	input: [z.string()], // parameters (must be an array or a ZodTuple)
	output: z.promise(z.boolean()), // return type
});

type MyFunctionType = z.infer<typeof MyFunction>;

const f: MyFunctionType = async (input) => {
	console.log(input);
	return input === "test";
};
