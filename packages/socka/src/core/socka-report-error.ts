import { exhaustiveGuard } from "@firtoz/maybe-error";

/**
 * Single discriminated union for optional `reportError` on session config and
 * `SockaRpc` options: `kind` narrows context; `error` is what was thrown or rejected.
 */
export type SockaReportError =
	| { kind: "clientEventListener"; eventName: string; error: unknown }
	| { kind: "clientEventValidation"; eventName: string; error: unknown }
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
