import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig, type PluginOption } from "vite";
import devtoolsJson from "vite-plugin-devtools-json";

/** HTTP dev server (app + Worker upgrade on this origin). */
const DEV_PORT = 5199;
/** HMR WebSocket only — separate from `DEV_PORT` so it cannot clash with app WS paths. */
const HMR_PORT = 5200;

export default defineConfig({
	resolve: {
		dedupe: ["react", "react-dom", "react-router"],
		tsconfigPaths: true,
		alias: [{ find: /\.sql$/, replacement: ".sql?raw" }],
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
		// Keep in sync with `package.json` `dev` script (`--port ${DEV_PORT}`). Use 5199
		// (not 5198) so `turbo run dev` does not collide with `test-playground` on 5198.
		port: DEV_PORT,
		strictPort: true,
		host: "127.0.0.1",
		// HMR on its own port: https://vite.dev/config/server-options.html#server-hmr
		hmr: {
			protocol: "ws",
			host: "127.0.0.1",
			port: HMR_PORT,
			clientPort: HMR_PORT,
		},
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
