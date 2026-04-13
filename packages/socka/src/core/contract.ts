import type { StandardSchemaV1 } from "@standard-schema/spec";

/**
 * Defines one RPC procedure: an optional input schema and a required output schema.
 * Both must be Standard Schema v1 compliant (Zod v4, Valibot, ArkType, etc.).
 */
export type SockaProcedureDef = {
	readonly input?: StandardSchemaV1;
	readonly output: StandardSchemaV1;
};

/** Configuration object accepted by {@link defineSocka}. */
export type SockaContractConfig = {
	readonly procedures: Record<string, SockaProcedureDef>;
	readonly events?: Record<string, StandardSchemaV1>;
};

/** Runtime contract returned by {@link defineSocka}, preserving full generic types. */
export type SockaContract<T extends SockaContractConfig = SockaContractConfig> =
	{
		readonly procedures: T["procedures"];
		readonly events: T extends { events: Record<string, StandardSchemaV1> }
			? T["events"]
			: Record<string, never>;
	};

type RpcFn<P extends SockaProcedureDef> = P extends {
	input: infer I extends StandardSchemaV1;
}
	? (
			input: StandardSchemaV1.InferInput<I>,
		) => Promise<StandardSchemaV1.InferOutput<P["output"]>>
	: () => Promise<StandardSchemaV1.InferOutput<P["output"]>>;

/**
 * Infers the typed RPC method map for a contract.
 *
 * ```ts
 * type MyRpc = InferSockaRpc<typeof myContract>;
 * // { list: () => Promise<Item[]>; insert: (input: { item: Item }) => Promise<void> }
 * ```
 */
export type InferSockaRpc<C extends SockaContract> = {
	[K in keyof C["procedures"]]: RpcFn<C["procedures"][K]>;
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
 * schema take `(input, session)`; procedures without input take `(session)` only.
 * Each handler returns the output that will be validated before sending.
 */
export type InferSockaHandlers<C extends SockaContract, TSession> = {
	[K in keyof C["procedures"]]: HandlerFn<C["procedures"][K], TSession>;
};

type InferEventPayload<S extends StandardSchemaV1> =
	StandardSchemaV1.InferOutput<S>;

/**
 * Payload type for a contract event (output of the event's Standard Schema).
 */
export type InferSockaEventPayload<
	C extends SockaContract<SockaContractConfig>,
	K extends keyof C["events"],
> = C["events"][K] extends StandardSchemaV1
	? InferEventPayload<C["events"][K]>
	: never;

/**
 * Infers the typed event handler map for a contract's events.
 */
export type InferSockaEventHandlers<C extends SockaContract> = {
	[K in keyof C["events"]]: C["events"][K] extends StandardSchemaV1
		? (payload: InferEventPayload<C["events"][K]>) => void | Promise<void>
		: never;
};

/**
 * Creates a socka contract from procedure and event definitions. Pass Zod, Valibot,
 * ArkType, or any Standard Schema v1 schemas directly — no adapters needed.
 *
 * ```ts
 * export const myContract = defineSocka({
 *   procedures: {
 *     list: { output: z.array(itemSchema) },
 *     insert: { input: z.object({ item: itemSchema }), output: z.void() },
 *   },
 * });
 * ```
 */
export function defineSocka<const T extends SockaContractConfig>(
	config: T,
): SockaContract<T> {
	return {
		procedures: config.procedures,
		events: (config.events ?? {}) as SockaContract<T>["events"],
	};
}
