#!/usr/bin/env bun
/**
 * Release script that orchestrates catalog resolution, publishing, and restoration
 * Ensures catalog references are always restored, even if publishing fails
 */

import { spawnSync } from "node:child_process";
import { join } from "node:path";

const scriptsDir = import.meta.dir;
const rootDir = join(scriptsDir, "..");

// Helper to run a script
function runScript(scriptPath: string, description: string): boolean {
	console.log(`\n${description}...`);
	const result = spawnSync("bun", [scriptPath], {
		cwd: rootDir,
		stdio: "inherit",
	});

	if (result.error) {
		console.error(`❌ Error running ${scriptPath}:`, result.error.message);
		return false;
	}

	if (result.status !== 0) {
		console.error(`❌ ${description} failed with exit code ${result.status}`);
		return false;
	}

	return true;
}

function runTurboBuild(): boolean {
	console.log("\n🔨 Building all packages (turbo, dependency order)...");
	const result = spawnSync(
		"bun",
		["turbo", "run", "build", "--filter", "./packages/*"],
		{
			cwd: rootDir,
			stdio: "inherit",
		},
	);

	if (result.error) {
		console.error("❌ Error running turbo build:", result.error.message);
		return false;
	}

	if (result.status !== 0) {
		console.error(`❌ Turbo build failed with exit code ${result.status}`);
		return false;
	}

	return true;
}

// Helper to run changeset publish
function runPublish(): boolean {
	console.log("\n📦 Publishing packages to npm...");
	const result = spawnSync("changeset", ["publish"], {
		cwd: rootDir,
		stdio: "inherit",
		env: {
			...process.env,
			// Skip per-package prepack rebuilds; dist/ was produced by turbo build above.
			npm_config_ignore_scripts: "true",
		},
	});

	if (result.error) {
		console.error("❌ Error running changeset publish:", result.error.message);
		return false;
	}

	if (result.status !== 0) {
		console.error(`❌ Publishing failed with exit code ${result.status}`);
		return false;
	}

	return true;
}

// Main release flow
let publishSuccess = false;
let resolveSuccess = false;

try {
	// Step 1: Resolve catalog references
	resolveSuccess = runScript(
		join(scriptsDir, "resolve-catalog.ts"),
		"🔧 Resolving catalog references for publishing",
	);

	if (!resolveSuccess) {
		console.error("\n❌ Failed to resolve catalog references. Aborting.");
		process.exit(1);
	}

	const buildSuccess = runTurboBuild();
	if (!buildSuccess) {
		console.error("\n❌ Turbo build failed. Restoring catalog in finally block.");
	} else {
		// Step 2: Publish to npm (prepack skipped — dist/ already built)
		publishSuccess = runPublish();
		if (!publishSuccess) {
			console.error("\n❌ Publishing failed!");
		}
	}
} finally {
	// Step 3: Always restore catalog references, even if publish failed
	console.log("\n🔄 Restoring catalog references...");
	const restoreSuccess = runScript(
		join(scriptsDir, "restore-catalog.ts"),
		"📝 Restoring catalog references",
	);

	if (!restoreSuccess) {
		console.error("\n⚠️  WARNING: Failed to restore catalog references!");
		console.error("   Please run: bun run restore-catalog");
		process.exit(1);
	}

	if (publishSuccess) {
		console.log("\n✅ Release complete!");
		console.log(
			"💡 Published packages have real versions, your repo has catalog: references",
		);
	} else {
		console.error("\n❌ Release failed, but catalog references were restored.");
		process.exit(1);
	}
}
