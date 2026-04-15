#!/usr/bin/env bun
/**
 * Prepend a Node shebang to a built JS file for npm `bin` entries.
 * Usage: bun scripts/add-node-shebang.ts <path-to-js>
 */
import { readFileSync, writeFileSync } from "node:fs";

const path = process.argv[2];
if (!path) {
	console.error("usage: bun scripts/add-node-shebang.ts <file>");
	process.exit(1);
}
let s = readFileSync(path, "utf8");
if (!s.startsWith("#!")) {
	writeFileSync(path, "#!/usr/bin/env node\n" + s);
}
