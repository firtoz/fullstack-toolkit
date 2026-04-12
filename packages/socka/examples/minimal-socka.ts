/**
 * Runnable sketch showing the socka contract API.
 *
 * From repo root:
 *   bun packages/socka/examples/minimal-socka.ts
 *
 * From `packages/socka`:
 *   bun run example:minimal
 */
import * as z from "zod";
import {
	type InferSockaRpc,
	defineSocka,
	decodeSockaWire,
	encodeClientRequest,
	encodeServerResponse,
} from "../src/core/index.ts";

const contract = defineSocka({
	procedures: {
		echo: {
			input: z.object({ text: z.string() }),
			output: z.object({ text: z.string() }),
		},
		ping: {
			output: z.object({ pong: z.literal(true) }),
		},
	},
});

type Rpc = InferSockaRpc<typeof contract>;

// Type-level proof: echo takes { text: string } and returns { text: string }
const _echoCheck: Rpc["echo"] extends (input: {
	text: string;
}) => Promise<{ text: string }>
	? true
	: false = true;

// Type-level proof: ping takes no args and returns { pong: true }
const _pingCheck: Rpc["ping"] extends () => Promise<{ pong: true }>
	? true
	: false = true;

// --- Wire round-trip demo ---
const clientFrame = encodeClientRequest("e-1", "echo", { text: "hello" });
console.log("Client → wire:", clientFrame);

const onServer = decodeSockaWire(clientFrame);
if (onServer.kind !== "clientRequest")
	throw new Error("expected clientRequest");
console.log("Server decoded:", onServer.frame.rpc, onServer.frame.body);

const serverFrame = encodeServerResponse("e-1", "echo", { text: "hello" });
console.log("Server → wire:", serverFrame);

const onClient = decodeSockaWire(serverFrame);
if (onClient.kind !== "serverResponse")
	throw new Error("expected serverResponse");
console.log("Client decoded:", onClient.frame.rpc, onClient.frame.body);

console.log("\nType checks passed:", _echoCheck && _pingCheck);
