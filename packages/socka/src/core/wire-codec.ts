/**
 * JSON text frames vs msgpack binary frames for the same socka v1 object graph.
 * Matches {@link decodeSockaWire} after parse/unpack.
 */

import { pack, unpack } from "msgpackr";
import type { SockaWireFrame } from "./envelope";

/** Wire encoding: UTF-8 JSON strings (default) or msgpack `ArrayBuffer` frames. */
export type SockaWireFormat = "json" | "msgpack";

/**
 * Encodes a socka frame for the wire. JSON returns a string; msgpack returns bytes
 * suitable for `WebSocket.send`.
 */
export function encodeSockaWire(
	frame: SockaWireFrame,
	format: SockaWireFormat,
	serializeJson: (value: unknown) => string = JSON.stringify,
): string | Uint8Array {
	if (format === "json") {
		return serializeJson(frame);
	}
	return pack(frame) as Uint8Array;
}

/**
 * Decodes a wire payload to a plain object before {@link decodeSockaWire}.
 * Msgpack mode accepts `ArrayBuffer` or `Uint8Array` (e.g. from `msgpackr` / `WebSocket`).
 */
export function parseWirePayload(
	data: string | ArrayBuffer | Uint8Array,
	format: SockaWireFormat,
	deserializeJson: (raw: string) => unknown = JSON.parse,
): unknown {
	if (format === "json") {
		if (typeof data !== "string") {
			throw new Error("socka: expected a JSON text frame");
		}
		return deserializeJson(data);
	}
	if (data instanceof Uint8Array) {
		return unpack(data);
	}
	if (data instanceof ArrayBuffer) {
		return unpack(new Uint8Array(data));
	}
	throw new Error("socka: expected an ArrayBuffer or Uint8Array msgpack frame");
}
