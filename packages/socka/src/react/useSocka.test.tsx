import { describe, expect, mock, test } from "bun:test";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createFakeWebSocket } from "../test-utils/fake-websocket";
import { rpcTestContract } from "../test-utils/rpc-contract-for-tests";
import { useSocka } from "./useSocka";

describe("useSocka", () => {
	test("ready becomes true after WebSocket open", async () => {
		const { socket, dispatchOpen } = createFakeWebSocket(WebSocket.CONNECTING);
		const { result } = renderHook(() =>
			useSocka({ contract: rpcTestContract, webSocket: socket }, []),
		);
		expect(result.current.ready).toBe(false);
		await act(async () => {
			dispatchOpen();
		});
		await waitFor(() => {
			expect(result.current.ready).toBe(true);
		});
	});

	test("cleanup rejects pending and closes socket", async () => {
		const closeSpy = mock(() => {});
		const { socket, dispatchOpen, sent } = createFakeWebSocket(
			WebSocket.CONNECTING,
		);
		socket.close = closeSpy;
		const { result, unmount } = renderHook(() =>
			useSocka({ contract: rpcTestContract, webSocket: socket }, []),
		);
		await act(async () => {
			dispatchOpen();
		});
		await waitFor(() => expect(result.current.ready).toBe(true));
		const session = result.current.sessionRef.current;
		if (session === null) {
			throw new Error("expected session");
		}
		const pending = session.rpc.echo({ text: "x" });
		expect(sent.length).toBe(1);
		unmount();
		await expect(pending).rejects.toThrow("WebSocket closed");
		expect(closeSpy).toHaveBeenCalled();
	});
});
