import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { ReservedSockaProcedureName } from "./reserved-procedure-names";

/**
 * Defines one client-initiated call: an optional input schema and a required output schema.
 * Both must be Standard Schema v1 compliant (Zod v4, Valibot, ArkType, etc.).
 */
export type SockaProcedureDef = {
	readonly input?: StandardSchemaV1;
	readonly output: StandardSchemaV1;
};

/** Configuration object accepted by {@link defineSocka}. */
export type SockaContractConfig = {
	readonly calls: Record<string, SockaProcedureDef>;
	readonly pushes?: Record<string, StandardSchemaV1>;
};

/**
 * When call keys are a **narrow** object type, rejects keys in
 * {@link ReservedSockaProcedureName} (thenable / `Object.prototype` hazards on
 * `session.send`). Wide `Record<string, SockaProcedureDef>` is unchanged so
 * dynamic maps still typecheck; use runtime validation (see {@link SockaSession}
 * `send`).
 */
export type ValidateSockaCallKeys<P extends Record<string, SockaProcedureDef>> =
	string extends keyof P
		? P
		: keyof P & ReservedSockaProcedureName extends never
			? P
			: never;

/** Runtime contract returned by {@link defineSocka}, preserving full generic types. */
export type SockaContract<T extends SockaContractConfig = SockaContractConfig> =
	{
		readonly calls: T["calls"];
		readonly pushes: T extends { pushes: Record<string, StandardSchemaV1> }
			? T["pushes"]
			: Record<string, never>;
	};

type CallFn<P extends SockaProcedureDef> = P extends {
	input: infer I extends StandardSchemaV1;
}
	? (
			input: StandardSchemaV1.InferInput<I>,
		) => Promise<StandardSchemaV1.InferOutput<P["output"]>>
	: () => Promise<StandardSchemaV1.InferOutput<P["output"]>>;

/**
 * Infers the typed `session.send.*` method map for a contract.
 */
export type InferSockaSend<C extends SockaContract> = {
	[K in keyof C["calls"]]: CallFn<C["calls"][K]>;
};

type HandlerOut<P extends SockaProcedureDef> =
	| StandardSchemaV1.InferOutput<P["output"]>
	| Promise<StandardSchemaV1.InferOutput<P["output"]>>;

type HandlerFn<P extends SockaProcedureDef, TSession> = P extends {
	input: infer I extends StandardSchemaV1;
}
	? (input: StandardSchemaV1.InferInput<I>, session: TSession) => HandlerOut<P>
	: (session: TSession) => HandlerOut<P>;

/**
 * Infers the typed server handler map for a contract. Handlers with an input
 * schema take `(input, session)`; calls without input take `(session)` only.
 * Each handler returns the output that will be validated before sending.
 */
export type InferSockaHandlers<C extends SockaContract, TSession> = {
	[K in keyof C["calls"]]: HandlerFn<C["calls"][K], TSession>;
};

type InferPushPayload<S extends StandardSchemaV1> =
	StandardSchemaV1.InferOutput<S>;

/**
 * Payload type for a contract push (output of the push's Standard Schema).
 */
export type InferSockaPushPayload<
	C extends SockaContract<SockaContractConfig>,
	K extends keyof C["pushes"],
> = C["pushes"][K] extends StandardSchemaV1
	? InferPushPayload<C["pushes"][K]>
	: never;

/**
 * Infers the typed push subscription handler map for a contract's `pushes`.
 */
export type InferSockaPushHandlers<C extends SockaContract> = {
	[K in keyof C["pushes"]]: C["pushes"][K] extends StandardSchemaV1
		? (payload: InferPushPayload<C["pushes"][K]>) => void | Promise<void>
		: never;
};

/**
 * Creates a socka contract from call and push definitions. Pass Zod, Valibot,
 * ArkType, or any Standard Schema v1 schemas directly — no adapters needed.
 *
 * ```ts
 * export const myContract = defineSocka({
 *   calls: {
 *     list: { output: z.array(itemSchema) },
 *     insert: { input: z.object({ item: itemSchema }), output: z.void() },
 *   },
 * });
 * ```
 *
 * Call names must not be {@link ReservedSockaProcedureName} — they would make
 * `session.send` thenable or unsafe as a plain method bag.
 */
export function defineSocka<const T extends SockaContractConfig>(
	config: T & { calls: ValidateSockaCallKeys<T["calls"]> },
): SockaContract<T> {
	return {
		calls: config.calls,
		pushes: (config.pushes ?? {}) as SockaContract<T>["pushes"],
	};
}
