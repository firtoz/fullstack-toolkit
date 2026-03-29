import { reactRouter } from "@react-router/dev/vite";
import { defineConfig, type PluginOption } from "vite";
import devtoolsJson from "vite-plugin-devtools-json";

export default defineConfig({
	plugins: [
		devtoolsJson(),
		reactRouter(),
		// tsconfigPaths(),
		// This is required for OPFS to work for sqlite-wasm.
		{
			name: "configure-response-headers",
			configureServer: (server) => {
				server.middlewares.use((_req, res, next) => {
					res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
					res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
					next();
				});
			},
		},
		// Fix for sqlite-wasm OPFS proxy worker module format issue
		{
			name: "sqlite-wasm-opfs-fix",
			enforce: "pre",
			resolveId(id) {
				// Intercept sqlite-wasm worker files
				if (
					id.includes("sqlite3-opfs-async-proxy.js") ||
					id.includes("@sqlite.org/sqlite-wasm")
				) {
					return null; // Let Vite handle it normally
				}
			},
			load(id) {
				// For the OPFS proxy worker, we need to ensure it's not treated as a classic worker
				if (id.includes("sqlite3-opfs-async-proxy.js")) {
					// Return null to let default loader handle it, but mark as module
					return null;
				}
			},
			transform(code, id) {
				// Transform worker creation calls to use module type
				if (
					id.includes("@sqlite.org/sqlite-wasm") &&
					code.includes("new Worker")
				) {
					// Replace Worker constructor calls to include module type
					// This handles cases like: new Worker(new URL("file.js", import.meta.url))
					let transformed = code;
					const workerRegex =
						/new\s+Worker\s*\(\s*(new\s+URL\s*\([^)]+,[^)]+\))\s*\)/g;
					transformed = transformed.replace(
						workerRegex,
						"new Worker($1, { type: 'module' })",
					);

					if (transformed !== code) {
						console.log(
							"[sqlite-wasm-opfs-fix] Transformed Worker constructor to use module type",
						);
						return {
							code: transformed,
							map: null,
						};
					}
				}
			},
		},
	] as PluginOption[],
	server: {
		headers: {
			"Cross-Origin-Opener-Policy": "same-origin",
			"Cross-Origin-Embedder-Policy": "require-corp",
		},
	},
	dev: {},
	optimizeDeps: {
		exclude: ["@sqlite.org/sqlite-wasm"],
		esbuildOptions: {
			// Don't optimize worker files
			plugins: [],
		},
	},
	worker: {
		format: "es",
		rollupOptions: {
			output: {
				format: "es",
			},
		},
	},
	resolve: {
		tsconfigPaths: true,
		alias: [
			{
				// Alias all .sql imports to .sql?raw
				find: /\.sql$/,
				replacement: ".sql?raw",
			},
		],
	},
});
