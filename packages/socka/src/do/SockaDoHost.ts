import type { Context } from "hono";
import type { SockaContractBound } from "../core/contract";
import type {
	SockaDoSession,
	SockaDoSessionConfigInput,
} from "./SockaDoSession";

/** Session data with no fields — `createData` may be omitted (defaults to `{}`). */
type EmptySockaSessionData = Record<string, never>;

/**
 * Durable Object (or test double) that owns the socka contract, shared
 * {@link SockaDoSession} map, and per-connection config for
 * {@link SockaDoSession}.
 */
export interface SockaDoHost<
	TContract extends SockaContractBound,
	TData = EmptySockaSessionData,
	TEnv extends object = Cloudflare.Env,
	TSession extends SockaDoSession<TContract, TData, TEnv> = SockaDoSession<
		TContract,
		TData,
		TEnv
	>,
> {
	readonly contract: TContract;
	readonly sessions: Map<WebSocket, TSession>;
	buildSockaSessionConfig(
		ctx: Context<{ Bindings: TEnv }> | undefined,
	): SockaDoSessionConfigInput<TContract, TData, TEnv>;
}

function hasSockaDoHostShape(value: object): value is {
	contract: SockaContractBound;
	sessions: Map<WebSocket, unknown>;
	buildSockaSessionConfig: (ctx: unknown) => unknown;
} {
	return (
		"contract" in value &&
		"sessions" in value &&
		"buildSockaSessionConfig" in value &&
		value.sessions instanceof Map &&
		typeof value.buildSockaSessionConfig === "function"
	);
}

/** @internal */
export function isSockaDoHost<
	TContract extends SockaContractBound,
	TData,
	TEnv extends object,
	TSession extends SockaDoSession<TContract, TData, TEnv>,
>(
	value: Map<WebSocket, SockaDoSession<TContract, TData, TEnv>> | SockaDoHost<
		TContract,
		TData,
		TEnv,
		TSession
	>,
): value is SockaDoHost<TContract, TData, TEnv, TSession> {
	return !(value instanceof Map) && hasSockaDoHostShape(value);
}
