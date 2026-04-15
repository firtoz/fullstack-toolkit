import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsup";
import { createLibTsupOptions } from "../../scripts/tsup-lib.ts";

const packageDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig(
	createLibTsupOptions(packageDir, {
		esbuildOptions(options) {
			options.loader = { ...options.loader, ".sql": "text" };
		},
	}),
);
