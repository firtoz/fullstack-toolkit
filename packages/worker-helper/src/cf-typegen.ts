#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
	discoverWranglerConfigs,
	findWorkspaceRoot,
} from "./cf-typegen-discovery";
import { prepareEnvFiles } from "./utils/prepare-env";

// First arg: directory (cwd). Remaining args: passed through to `wrangler types`.
const cwd = process.argv[2];
const extraWranglerArgs = process.argv.slice(3);

if (!cwd || !fs.existsSync(cwd)) {
	console.error(
		"Please specify a directory as the first parameter. Usually $(pwd).",
	);
	process.exit(1);
}

console.log(`Running CF typegen for: ${cwd}`);

function runWranglerTypes() {
	const envFiles = prepareEnvFiles(cwd);

	console.log("Running wrangler types...");

	// Discover wrangler configs from npm/bun workspace definition (includes untracked packages)
	const workspaceRoot = findWorkspaceRoot(cwd);
	let allConfigs: string[];
	if (workspaceRoot) {
		allConfigs = discoverWranglerConfigs(cwd);
	} else {
		console.warn("⚠ No workspace root found, using current directory only");
		allConfigs = [];
	}

	if (allConfigs.length > 0) {
		console.log(`  Found ${allConfigs.length} wrangler config(s) in workspace`);
	}

	// Build args for wrangler types: multiple -c flags, --env-file, then any extra args
	// The first config should be the current directory's wrangler.jsonc
	const args: string[] = ["types", "-c", "wrangler.jsonc"];

	// Add other configs (relative to cwd for better readability)
	const currentWranglerJsonc = path.join(cwd, "wrangler.jsonc");
	const currentWranglerJson = path.join(cwd, "wrangler.json");

	for (const configPath of allConfigs) {
		const resolvedPath = path.resolve(configPath);
		// Skip if it's the current directory's config
		if (
			resolvedPath === currentWranglerJsonc ||
			resolvedPath === currentWranglerJson
		) {
			continue;
		}
		// Make path relative to cwd
		const relativePath = path.relative(cwd, configPath);
		args.push("-c", relativePath);
	}

	for (const envFile of envFiles) {
		args.push("--env-file", envFile);
	}

	args.push(...extraWranglerArgs);

	const command = `wrangler ${args.join(" ")}`;
	console.log(`  Command: ${command}`);

	const result = spawnSync("wrangler", args, {
		cwd,
		stdio: "inherit",
	});
	if (result.status !== 0) {
		console.error("Failed to run wrangler types");
		process.exit(1);
	}
	console.log("✓ Wrangler types generated with all workspace bindings");
}

// Run all steps
try {
	runWranglerTypes();
	console.log("\n✓ CF typegen completed successfully");
} catch (error: unknown) {
	console.error("\n✗ CF typegen failed:", error);
	process.exit(1);
}
