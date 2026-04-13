import { describe, expect, test } from "bun:test";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useRef } from "react";
import type { SockaRpc } from "../client/SockaRpc";
import { encodeServerResponse } from "../core/envelope";
import { encodeSockaWire } from "../core/wire-codec";
import { createFakeWebSocket } from "../test-utils/fake-websocket";
import { rpcTestContract } from "../test-utils/rpc-contract-for-tests";
import { createSockaRpcProxyFromSession, useSockaRpc } from "./useSockaRpc";

describe("createSockaRpcProxyFromSession", () => {
	test("rejects when session ref is null", async () => {
		const { result } = renderHook(() => {
			const r = useRef<SockaRpc<typeof rpcTestContract> | null>(null);
			const rpc = createSockaRpcProxyFromSession(rpcTestContract, r);
			return { rpc };
		});
		await expect(result.current.rpc.echo({ text: "a" })).rejects.toThrow(
			"WebSocket not connected",
		);
	});
});

describe("useSockaRpc", () => {
	test("rpc.echo resolves after server response", async () => {
		const { socket, dispatchOpen, dispatchMessage, sent } = createFakeWebSocket(
			WebSocket.CONNECTING,
		);
		const { result } = renderHook(() =>
			useSockaRpc(rpcTestContract, { webSocket: socket }, []),
		);
		await act(async () => {
			dispatchOpen();
		});
		await waitFor(() => expect(result.current.ready).toBe(true));
		const echoPromise = result.current.rpc.echo({ text: "hi" });
		await Promise.resolve();
		await Promise.resolve();
		const id = (JSON.parse(sent[0] as string) as { id: string }).id;
		dispatchMessage(
			encodeSockaWire(
				encodeServerResponse(id, "echo", { text: "hi" }),
				"json",
			) as string,
		);
		await expect(echoPromise).resolves.toEqual({ text: "hi" });
	});
});
