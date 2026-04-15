import { describe, expect, test } from "bun:test";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useRef } from "react";
import type { SockaSession } from "../client/SockaSession";
import { encodeServerResponse } from "../core/envelope";
import { encodeSockaWire } from "../core/wire-codec";
import { createFakeWebSocket } from "../test-utils/fake-websocket";
import { rpcTestContract } from "../test-utils/rpc-contract-for-tests";
import {
	createSockaSendProxyFromSession,
	useSockaSession,
} from "./useSockaSession";

describe("createSockaSendProxyFromSession", () => {
	test("rejects when session ref is null", async () => {
		const { result } = renderHook(() => {
			const r = useRef<SockaSession<typeof rpcTestContract> | null>(null);
			const send = createSockaSendProxyFromSession(rpcTestContract, r);
			return { send };
		});
		await expect(result.current.send.echo({ text: "a" })).rejects.toThrow(
			"session ref is null",
		);
	});
});

describe("useSockaSession", () => {
	test("send.echo resolves after server response", async () => {
		const { socket, dispatchOpen, dispatchMessage, sent } = createFakeWebSocket(
			WebSocket.CONNECTING,
		);
		const { result } = renderHook(() =>
			useSockaSession(rpcTestContract, { webSocket: socket }, []),
		);
		await act(async () => {
			dispatchOpen();
		});
		await waitFor(() => expect(result.current.ready).toBe(true));
		const echoPromise = result.current.send.echo({ text: "hi" });
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
