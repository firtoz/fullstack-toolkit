import { describe, expect, it } from "bun:test";
import { WebsocketWrapper } from "./WebsocketWrapper";

describe("websocket-do", () => {
	it("exports should be available", () => {
		expect(WebsocketWrapper).toBeDefined();
	});
});
