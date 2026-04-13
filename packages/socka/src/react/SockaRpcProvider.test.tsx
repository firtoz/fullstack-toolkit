import { describe, expect, test } from "bun:test";
import { renderHook } from "@testing-library/react";
import * as z from "zod";
import { defineSocka } from "../core/contract";
import { createFakeWebSocket } from "../test-utils/fake-websocket";
import { rpcTestContract } from "../test-utils/rpc-contract-for-tests";
import { SockaRpcProvider, useSockaRpcContext } from "./SockaRpcProvider";

const otherContract = defineSocka({
	procedures: {
		only: { output: z.void() },
	},
});

describe("SockaRpcProvider / useSockaRpcContext", () => {
	test("useSockaRpcContext throws outside provider", () => {
		expect(() => {
			renderHook(() => useSockaRpcContext(rpcTestContract));
		}).toThrow("useSockaRpcContext must be used within a SockaRpcProvider");
	});

	test("useSockaRpcContext throws when contract ref differs", () => {
		const { socket } = createFakeWebSocket(WebSocket.OPEN);
		expect(() => {
			renderHook(() => useSockaRpcContext(otherContract), {
				wrapper: ({ children }) => (
					<SockaRpcProvider
						contract={rpcTestContract}
						deps={[]}
						webSocket={socket}
					>
						{children}
					</SockaRpcProvider>
				),
			});
		}).toThrow(
			"useSockaRpcContext: `contract` must be the same reference as SockaRpcProvider's `contract`",
		);
	});
});
