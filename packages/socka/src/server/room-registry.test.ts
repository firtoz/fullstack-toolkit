import { describe, expect, test } from "bun:test";
import { rpcTestContract } from "../test-utils/rpc-contract-for-tests";
import { createSockaRoomRegistry } from "./room-registry";

describe("createSockaRoomRegistry", () => {
	test("returns stable sessionMap and config per roomId", () => {
		const registry = createSockaRoomRegistry<
			typeof rpcTestContract,
			Record<string, never>
		>((_roomId, _sessionMap) => ({
			contract: rpcTestContract,
			handlers: {
				echo: async (input) => ({ text: input.text }),
				ping: async () => ({ pong: true as const }),
			},
			handleClose: async () => {},
		}));
		const a = registry.get("a");
		const a2 = registry.get("a");
		const b = registry.get("b");
		expect(a.sessionMap).toBe(a2.sessionMap);
		expect(a.config).toBe(a2.config);
		expect(a.sessionMap).not.toBe(b.sessionMap);
		expect(registry.rooms.size).toBe(2);
	});
});
