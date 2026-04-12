/**
 * Versioned socka wire framing. After JSON parse or msgpack unpack, every frame
 * must satisfy {@link decodeSockaWire}; procedure bodies are validated with Standard Schema on each side.
 */

export const SOCKA_WIRE_VERSION = 1 as const;

export class SockaWireError extends Error {
	override readonly name = "SockaWireError";
}

export type SockaClientRequestFrame = {
	readonly socka: "clientRequest";
	readonly v: typeof SOCKA_WIRE_VERSION;
	readonly id: string;
	readonly rpc: string;
	readonly body: Record<string, unknown>;
};

export type SockaServerResponseFrame = {
	readonly socka: "serverResponse";
	readonly v: typeof SOCKA_WIRE_VERSION;
	readonly id: string;
	readonly rpc: string;
	readonly body: unknown;
};

export type SockaServerErrorFrame = {
	readonly socka: "serverError";
	readonly v: typeof SOCKA_WIRE_VERSION;
	readonly id: string;
	readonly error: string;
};

export type SockaServerEventFrame = {
	readonly socka: "serverEvent";
	readonly v: typeof SOCKA_WIRE_VERSION;
	readonly event: string;
	readonly body: unknown;
};

export type SockaWireFrame =
	| SockaClientRequestFrame
	| SockaServerResponseFrame
	| SockaServerErrorFrame
	| SockaServerEventFrame;

export type DecodedSockaWire =
	| { readonly kind: "clientRequest"; readonly frame: SockaClientRequestFrame }
	| {
			readonly kind: "serverResponse";
			readonly frame: SockaServerResponseFrame;
	  }
	| { readonly kind: "serverError"; readonly frame: SockaServerErrorFrame }
	| { readonly kind: "serverEvent"; readonly frame: SockaServerEventFrame };

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Decodes a parsed wire object (from JSON or msgpack). Throws {@link SockaWireError}
 * if the payload is not a valid socka v1 frame.
 */
export function decodeSockaWire(parsed: unknown): DecodedSockaWire {
	if (!isRecord(parsed)) {
		throw new SockaWireError("socka: expected a JSON object");
	}
	if (parsed.socka === undefined) {
		throw new SockaWireError('socka: missing "socka" discriminator');
	}
	if (parsed.v !== SOCKA_WIRE_VERSION) {
		throw new SockaWireError("socka: unsupported wire version");
	}
	const socka = parsed.socka;
	if (
		socka === "clientRequest" &&
		typeof parsed.id === "string" &&
		typeof parsed.rpc === "string" &&
		isRecord(parsed.body)
	) {
		return {
			kind: "clientRequest",
			frame: parsed as SockaClientRequestFrame,
		};
	}
	if (
		socka === "serverResponse" &&
		typeof parsed.id === "string" &&
		typeof parsed.rpc === "string"
	) {
		return {
			kind: "serverResponse",
			frame: parsed as SockaServerResponseFrame,
		};
	}
	if (
		socka === "serverError" &&
		typeof parsed.id === "string" &&
		typeof parsed.error === "string"
	) {
		return {
			kind: "serverError",
			frame: parsed as SockaServerErrorFrame,
		};
	}
	if (socka === "serverEvent" && typeof parsed.event === "string") {
		return {
			kind: "serverEvent",
			frame: parsed as SockaServerEventFrame,
		};
	}
	throw new SockaWireError(
		`socka: unknown or invalid frame kind ${String(socka)}`,
	);
}

/** Builds a socka v1 client request frame. */
export function encodeClientRequest(
	id: string,
	rpc: string,
	body: Record<string, unknown>,
): SockaClientRequestFrame {
	return { socka: "clientRequest", v: SOCKA_WIRE_VERSION, id, rpc, body };
}

/** Builds a socka v1 server response frame. */
export function encodeServerResponse(
	id: string,
	rpc: string,
	body: unknown,
): SockaServerResponseFrame {
	return { socka: "serverResponse", v: SOCKA_WIRE_VERSION, id, rpc, body };
}

/** Builds a socka v1 server error frame. */
export function encodeServerError(
	id: string,
	error: string,
): SockaServerErrorFrame {
	return { socka: "serverError", v: SOCKA_WIRE_VERSION, id, error };
}

/** Builds a socka v1 server event frame. */
export function encodeServerEvent(
	event: string,
	body: unknown,
): SockaServerEventFrame {
	return { socka: "serverEvent", v: SOCKA_WIRE_VERSION, event, body };
}
