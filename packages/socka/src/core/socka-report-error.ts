import { exhaustiveGuard } from "@firtoz/maybe-error";
import type { SockaError } from "./socka-error";

/**
 * Single discriminated union for optional `reportError` on session config and
 * `SockaSession` options: `kind` narrows context; `error` is what was thrown or rejected.
 */
export type SockaReportError =
	| { kind: "clientEventListener"; eventName: string; error: unknown }
	| { kind: "clientEventValidation"; eventName: string; error: unknown }
	/**
	 * `serverError` for a fire-and-forget call (no pending client promise). Prefer
	 * setting `reportError` on the session when using output-less procedures.
	 */
	| { kind: "clientFireAndForgetRpcError"; error: SockaError }
	/**
	 * `serverError` with no matching pending entry for a call that expects a response
	 * (e.g. stale id after reconnect or duplicate frame).
	 */
	| { kind: "clientOrphanServerError"; error: SockaError }
	/**
	 * Server sent `serverResponse` for a procedure with no `output` (misbehaving server).
	 */
	| {
			kind: "clientUnexpectedServerResponse";
			rpc: string;
			requestId: string;
	  }
	| { kind: "serverOnAttached"; error: unknown }
	| {
			kind: "serverInboundMessage";
			/** `hono` uses the same log line as the Hono adapters; others use attach-style. */
			adapter: "attach" | "hono" | "bun";
			error: unknown;
	  }
	| { kind: "serverHandleClose"; error: unknown }
	| {
			kind: "serverShutdown";
			adapter: "attach" | "hono";
			error: unknown;
	  };

/** Default `console.error` behavior; same messages as pre–`reportError` socka. */
export function defaultReportError(event: SockaReportError): void {
	switch (event.kind) {
		case "clientEventListener":
			console.error("socka: event listener error", event.error);
			return;
		case "clientEventValidation":
			console.error("socka: event validation error", event.error);
			return;
		case "clientFireAndForgetRpcError":
			console.error("socka: fire-and-forget RPC error", event.error);
			return;
		case "clientOrphanServerError":
			console.error("socka: orphan serverError (no pending RPC)", event.error);
			return;
		case "clientUnexpectedServerResponse":
			console.error(
				"socka: unexpected serverResponse for fire-and-forget RPC",
				event.rpc,
				event.requestId,
			);
			return;
		case "serverOnAttached":
			console.error("socka: onAttached error:", event.error);
			return;
		case "serverInboundMessage":
			if (event.adapter === "hono") {
				console.error("socka: onMessage error:", event.error);
			} else {
				console.error("socka: message handler error:", event.error);
			}
			return;
		case "serverHandleClose":
			console.error("socka: handleClose error:", event.error);
			return;
		case "serverShutdown":
			if (event.adapter === "hono") {
				console.error("socka: onClose error:", event.error);
			} else {
				console.error("socka: shutdown error:", event.error);
			}
			return;
		default:
			exhaustiveGuard(event);
	}
}

/** Invokes the optional `reportError` callback when provided, otherwise `defaultReportError`. */
export function reportSockaError(
	reportError: ((event: SockaReportError) => void) | undefined,
	event: SockaReportError,
): void {
	(reportError ?? defaultReportError)(event);
}
