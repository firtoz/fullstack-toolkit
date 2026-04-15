import { describe, expect, test } from "bun:test";
import { renderHook } from "@testing-library/react";
import * as z from "zod";
import { defineSocka } from "../core/contract";
import { createFakeWebSocket } from "../test-utils/fake-websocket";
import { rpcTestContract } from "../test-utils/rpc-contract-for-tests";
import {
	SockaSessionProvider,
	useSockaSessionContext,
} from "./SockaSessionProvider";

const otherContract = defineSocka({
	calls: {
		only: { output: z.void() },
	},
});

describe("SockaSessionProvider / useSockaSessionContext", () => {
	test("useSockaSessionContext throws outside provider", () => {
		expect(() => {
			renderHook(() => useSockaSessionContext(rpcTestContract));
		}).toThrow(
			"useSockaSessionContext must be used within a SockaSessionProvider",
		);
	});

	test("useSockaSessionContext throws when contract ref differs", () => {
		const { socket } = createFakeWebSocket(WebSocket.OPEN);
		expect(() => {
			renderHook(() => useSockaSessionContext(otherContract), {
				wrapper: ({ children }) => (
					<SockaSessionProvider
						contract={rpcTestContract}
						deps={[]}
						webSocket={socket}
					>
						{children}
					</SockaSessionProvider>
				),
			});
		}).toThrow(
			"useSockaSessionContext: `contract` must be the same reference as SockaSessionProvider's `contract`",
		);
	});
});
