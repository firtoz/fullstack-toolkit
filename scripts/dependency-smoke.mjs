import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

// Exercise both production tooling and the Vitest pool's independently pinned runtime.
const runtimePaths = new Set(
	["wrangler/package.json", "@cloudflare/vitest-pool-workers"].map((parent) =>
		createRequire(import.meta.resolve(parent)).resolve("miniflare"),
	),
);
for (const miniflarePath of runtimePaths) {
	const fromMiniflare = createRequire(miniflarePath);
	const { Miniflare, convertV4MiniflareOptions } = await import(
		pathToFileURL(miniflarePath).href
	);
	const sharp = fromMiniflare("sharp");
	const png = await sharp({
		create: {
			width: 1,
			height: 1,
			channels: 3,
			background: { r: 0, g: 0, b: 0 },
		},
	})
		.resize(2, 2)
		.png()
		.toBuffer();
	assert.equal((await sharp(png).metadata()).width, 2);

	const runtime = new Miniflare(
		(convertV4MiniflareOptions ?? ((options) => options))({
			modules: true,
			compatibilityDate: "2026-04-24",
			d1Databases: ["DB"],
			script: `
    export default {
      async fetch(request, env) {
        if (request.headers.get("Upgrade") === "websocket") {
          const pair = new WebSocketPair();
          pair[1].accept();
          pair[1].addEventListener("message", (event) => pair[1].send("echo:" + event.data));
          return new Response(null, { status: 101, webSocket: pair[0] });
        }
        const row = await env.DB.prepare("SELECT 42 AS answer").first();
        return Response.json(row);
      },
    };
  `,
		}),
	);
	try {
		const response = await runtime.dispatchFetch("http://localhost/");
		assert.equal(response.status, 200);
		assert.deepEqual(await response.json(), { answer: 42 });
		const upgraded = await runtime.dispatchFetch("http://localhost/socket", {
			headers: { Upgrade: "websocket" },
		});
		assert.equal(upgraded.status, 101);
		const socket = upgraded.webSocket;
		assert.ok(socket);
		socket.accept();
		try {
			const echoed = new Promise((resolve, reject) => {
				const timer = setTimeout(
					() => reject(new Error("WebSocket echo timed out")),
					5000,
				);
				socket.addEventListener(
					"message",
					(event) => {
						clearTimeout(timer);
						resolve(event.data);
					},
					{ once: true },
				);
				socket.send("ping");
			});
			assert.equal(await echoed, "echo:ping");
		} finally {
			socket.close(1000, "smoke completed");
		}
		console.log(
			"Wrangler Miniflare: HTTP, D1, WebSocket and Sharp smoke passed",
		);
	} finally {
		await runtime.dispose();
	}
}

const fromAgents = createRequire(import.meta.resolve("agents"));
const { Client } = fromAgents("@modelcontextprotocol/sdk/client/index.js");
const { McpServer } = fromAgents("@modelcontextprotocol/sdk/server/mcp.js");
const { InMemoryTransport } = fromAgents(
	"@modelcontextprotocol/sdk/inMemory.js",
);
const server = new McpServer({
	name: "security-smoke-server",
	version: "1.0.0",
});
server.registerTool(
	"probe",
	{ description: "Verify patched MCP transport" },
	async () => ({
		content: [{ type: "text", text: "patched SDK works" }],
	}),
);
const client = new Client({ name: "security-smoke-client", version: "1.0.0" });
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
try {
	await server.connect(serverTransport);
	await client.connect(clientTransport);
	const result = await client.callTool({ name: "probe" });
	assert.equal(result.isError, undefined);
	assert.deepEqual(result.content, [
		{ type: "text", text: "patched SDK works" },
	]);
	console.log(
		"Agents MCP SDK: real client/server handshake and tool call passed",
	);
} finally {
	await client.close();
	await server.close();
}
