import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig, type PluginOption } from "vite";
import devtoolsJson from "vite-plugin-devtools-json";

export default defineConfig({
	resolve: {
		// Single React + router copies for SSR; otherwise FrameworkContext from
		// ServerRouter does not match <Meta>/<Links> and SSR throws "HydratedRouter".
		dedupe: ["react", "react-dom", "react-router"],
		tsconfigPaths: true,
		alias: [
			{
				// Allow importing generated drizzle SQL migrations as text.
				find: /\.sql$/,
				replacement: ".sql?raw",
			},
		],
	},
	plugins: [
		devtoolsJson(),
		cloudflare({
			configPath: "./wrangler.app.jsonc",
			viteEnvironment: { name: "ssr" },
			auxiliaryWorkers: [{ configPath: "./wrangler.jsonc" }],
			inspectorPort: false,
		}),
		reactRouter(),
		// Required for SharedArrayBuffer + OPFS in sqlite-wasm.
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
		// sqlite-wasm OPFS proxy worker expects module workers.
		{
			name: "sqlite-wasm-opfs-fix",
			enforce: "pre",
			transform(code, id) {
				if (
					id.includes("@sqlite.org/sqlite-wasm") &&
					code.includes("new Worker")
				) {
					const workerRegex =
						/new\s+Worker\s*\(\s*(new\s+URL\s*\([^)]+,[^)]+\))\s*\)/g;
					const transformed = code.replace(
						workerRegex,
						"new Worker($1, { type: 'module' })",
					);
					if (transformed !== code) {
						return { code: transformed, map: null };
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
	optimizeDeps: {
		exclude: ["@sqlite.org/sqlite-wasm"],
	},
	worker: {
		format: "es",
		rollupOptions: {
			output: {
				format: "es",
			},
		},
	},
});
