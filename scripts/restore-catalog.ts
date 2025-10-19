#!/usr/bin/env bun
/**
 * Script to restore catalog: references in package.json files after publishing
 * Uses git to restore the original package.json files with catalog references
 */

import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { Glob } from "bun";

const rootDir = join(import.meta.dir, "..");

console.log("🔄 Restoring package.json files from git...\n");

// Find all package.json files in packages/
const glob = new Glob("packages/*/package.json");
const packageJsonFiles = Array.from(glob.scanSync({ cwd: rootDir }));

if (packageJsonFiles.length === 0) {
	console.log("⚠️  No package.json files found in packages/");
	process.exit(0);
}

// Use git restore to revert the package.json files
const result = spawnSync("git", ["restore", ...packageJsonFiles], {
	cwd: rootDir,
	stdio: "pipe",
	encoding: "utf-8",
});

if (result.error) {
	console.error("❌ Error running git restore:", result.error.message);
	process.exit(1);
}

if (result.status !== 0) {
	console.error("❌ Git restore failed:");
	console.error(result.stderr);
	process.exit(1);
}

console.log("✅ Successfully restored catalog references in:");
for (const file of packageJsonFiles) {
	console.log(`   ${file}`);
}

console.log("\n✨ All package.json files restored to their original state!");
console.log(
	"💡 Tip: The published packages have real versions, but your repo has catalog: references",
);
