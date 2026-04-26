import type { SockaContractBound } from "../core/contract";
import type { SockaWireFormat } from "../core/wire-codec";
import type { SockaWebSocketSession } from "./SockaWebSocketSession";

/**
 * Decode a WebSocket `message` payload and dispatch it to the session (same
 * behavior as the `message` handler installed by {@link attachSockaWebSocket}).
 * Use this when the runtime does not support `addEventListener` on the socket
 * (e.g. Bun {@link ServerWebSocket}) or when handling messages manually.
 */
export async function dispatchSockaInboundMessage<
	TContract extends SockaContractBound,
	TData,
>(
	session: SockaWebSocketSession<TContract, TData>,
	wireFormat: SockaWireFormat,
	data: MessageEvent["data"],
): Promise<void> {
	if (typeof data === "string") {
		await session.handleRawMessage(data);
		return;
	}
	if (typeof Buffer !== "undefined" && Buffer.isBuffer(data)) {
		if (wireFormat === "json") {
			await session.handleRawMessage(data.toString("utf8"));
			return;
		}
		await session.handleBinaryMessage(new Uint8Array(data).buffer);
		return;
	}
	if (data instanceof ArrayBuffer) {
		if (wireFormat === "json") {
			await session.handleRawMessage(new TextDecoder().decode(data));
			return;
		}
		await session.handleBinaryMessage(data);
		return;
	}
	if (data instanceof Blob) {
		if (wireFormat === "json") {
			await session.handleRawMessage(await data.text());
		} else {
			await session.handleBinaryMessage(await data.arrayBuffer());
		}
		return;
	}
	if (ArrayBuffer.isView(data)) {
		const v = data;
		const view = new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
		if (wireFormat === "json") {
			await session.handleRawMessage(new TextDecoder().decode(view));
			return;
		}
		const copy = new Uint8Array(view.length);
		copy.set(view);
		await session.handleBinaryMessage(copy.buffer);
	}
}
