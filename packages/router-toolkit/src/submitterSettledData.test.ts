import { describe, expectTypeOf, it } from "bun:test";
import { success } from "@firtoz/maybe-error";
import { z } from "zod";
import type { SubmitJsonResult } from "./ConcurrentSubmitterProvider";
import { formAction } from "./formAction";
import type { RouteWithActionModule } from "./types/RouteWithActionModule";
import type { ActionResult } from "./useConcurrentSubmitter";
import type {
	DynamicSubmitterData,
	SubmitterSettledData,
} from "./useDynamicSubmitter";

const schema = z.object({ ping: z.string() });

const formActionRouteAction = formAction({
	schema,
	handler: async (_args, _data) =>
		success({ msg: "from-form-action" as const }),
});

type FormActionModule = RouteWithActionModule & {
	route: "/api/submit";
	formSchema: typeof schema;
	action: typeof formActionRouteAction;
};

async function plainJsonAction(): Promise<{
	kind: "plain";
	customField: string;
}> {
	return { kind: "plain", customField: "x" };
}

type PlainModule = RouteWithActionModule & {
	route: "/api/submit";
	formSchema: typeof schema;
	action: typeof plainJsonAction;
};

describe("SubmitterSettledData", () => {
	it("matches NonNullable fetcher data (formAction / MaybeError)", () => {
		expectTypeOf<SubmitterSettledData<FormActionModule>>().toEqualTypeOf<
			NonNullable<DynamicSubmitterData<FormActionModule>>
		>();
	});

	it("matches NonNullable fetcher data (plain action return)", () => {
		expectTypeOf<SubmitterSettledData<PlainModule>>().toEqualTypeOf<
			NonNullable<DynamicSubmitterData<PlainModule>>
		>();
	});

	it("useConcurrentSubmitter submitJson promise is ActionResult (formAction module)", () => {
		expectTypeOf<
			SubmitJsonResult<ActionResult<FormActionModule>>["promise"]
		>().toEqualTypeOf<Promise<ActionResult<FormActionModule>>>();
	});

	it("useConcurrentSubmitter submitJson promise is ActionResult (plain module)", () => {
		expectTypeOf<
			SubmitJsonResult<ActionResult<PlainModule>>["promise"]
		>().toEqualTypeOf<Promise<ActionResult<PlainModule>>>();
	});
});
