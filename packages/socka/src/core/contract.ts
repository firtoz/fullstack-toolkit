import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { ReservedSockaProcedureName } from "./reserved-procedure-names";

/**
 * Defines one client-initiated call: optional `input` and optional `output` schemas
 * (Standard Schema v1: Zod v4, Valibot, ArkType, etc.).
 *
 * - **`output` present** (including `z.void()`): request/response RPC; the server sends
 *   a validated `serverResponse` on success.
 * - **`output` omitted**: fire-and-forget on success (no `serverResponse`); the client
 *   `send` method resolves after the request is sent. Use `output: z.void()` when you
 *   still want a correlated ack. See the package README and {@link defineSocka}.
 */
export type SockaProcedureDef = {
	readonly input?: StandardSchemaV1;
	readonly output?: StandardSchemaV1;
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

/** Inferred client return type for a call: payload type or `void` when `output` is omitted. */
type InferSockaCallReturn<P extends SockaProcedureDef> =
	P["output"] extends StandardSchemaV1
		? StandardSchemaV1.InferOutput<P["output"]>
		: // biome-ignore lint/suspicious/noConfusingVoidType: This is correct
			void;

type CallFn<P extends SockaProcedureDef> = P extends {
	input: infer I extends StandardSchemaV1;
}
	? (input: StandardSchemaV1.InferInput<I>) => Promise<InferSockaCallReturn<P>>
	: () => Promise<InferSockaCallReturn<P>>;

/**
 * Infers the typed `session.send.*` method map for a contract.
 */
export type InferSockaSend<C extends SockaContract> = {
	[K in keyof C["calls"]]: CallFn<C["calls"][K]>;
};

type HandlerOut<P extends SockaProcedureDef> =
	P["output"] extends StandardSchemaV1
		?
				| StandardSchemaV1.InferOutput<P["output"]>
				| Promise<StandardSchemaV1.InferOutput<P["output"]>>
		: void | Promise<void>;

type HandlerFn<P extends SockaProcedureDef, TSession> = P extends {
	input: infer I extends StandardSchemaV1;
}
	? (input: StandardSchemaV1.InferInput<I>, session: TSession) => HandlerOut<P>
	: (session: TSession) => HandlerOut<P>;

/**
 * Infers the typed server handler map for a contract. Handlers with an input
 * schema take `(input, session)`; calls without input take `(session)` only.
 * When `output` is present, the return value is validated and sent as `serverResponse`.
 * When `output` is omitted (fire-and-forget), the handler should return `void`; the
 * server does not send a success response.
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
 *     notify: { input: z.object({ text: z.string() }) },
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
