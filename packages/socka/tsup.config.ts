import { defineConfig } from "tsup";

/** Packages resolved from node_modules (not bundled into socka). */
const external = [
	"@firtoz/maybe-error",
	"@firtoz/websocket-do",
	"@standard-schema/spec",
	"msgpackr",
	"hono",
	"@hono/node-server",
	"@hono/node-ws",
	"react",
	"react-dom",
	"react/jsx-runtime",
	"ws",
] as const;

export default defineConfig({
	entry: {
		"core/index": "src/core/index.ts",
		"client/index": "src/client/index.ts",
		"react/index": "src/react/index.ts",
		"do/index": "src/do/index.ts",
		"server/index": "src/server/index.ts",
		"bun/index": "src/bun/index.ts",
		"hono/index": "src/hono/index.ts",
		"hono/cloudflare-workers": "src/hono/cloudflare-workers.ts",
	},
	format: ["esm"],
	dts: true,
	outDir: "dist",
	clean: true,
	sourcemap: true,
	splitting: true,
	treeshake: true,
	target: "es2020",
	platform: "neutral",
	bundle: true,
	external: [...external],
	esbuildOptions(options) {
		options.jsx = "automatic";
	},
});
