import { execSync } from "node:child_process";
import * as fs from "node:fs";
import path from "node:path";
import process from "node:process";

// Use the current working directory
const cwd = process.argv[2];
if (!cwd || !fs.existsSync(cwd)) {
	console.error(
		"Please specify a directory as the first parameter. Usually $(pwd).",
	);
	process.exit(1);
}

console.log(`Running CF typegen for: ${cwd}`);

/**
 * Extracts required env vars from .env.local.example
 */
function getRequiredEnvVars(examplePath: string): string[] {
	try {
		if (!fs.existsSync(examplePath)) {
			return [];
		}

		const content = fs.readFileSync(examplePath, "utf8");
		const vars: string[] = [];

		// Parse .env format: VAR_NAME=value
		for (const line of content.split("\n")) {
			const trimmed = line.trim();
			// Skip comments and empty lines
			if (!trimmed || trimmed.startsWith("#")) continue;

			const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)=/);
			if (match) {
				vars.push(match[1]);
			}
		}

		return vars;
	} catch (err) {
		console.warn(`Failed to read ${examplePath}:`, err);
		return [];
	}
}

/**
 * Ensures .env.local exists with required env vars from .env.local.example
 */
function prepareEnvLocal(): { created: boolean; added: string[] } {
	const envPath = path.join(cwd, ".env.local");
	const examplePath = path.join(cwd, ".env.local.example");

	if (!fs.existsSync(examplePath)) {
		console.log("No .env.local.example found, skipping env preparation");
		return { created: false, added: [] };
	}

	const requiredVars = getRequiredEnvVars(examplePath);
	if (requiredVars.length === 0) {
		console.log("No vars found in .env.local.example");
		return { created: false, added: [] };
	}

	let content = "";
	let created = false;
	const added: string[] = [];

	if (fs.existsSync(envPath)) {
		content = fs.readFileSync(envPath, "utf8");
	} else {
		created = true;
	}

	// Check which vars are missing
	for (const varName of requiredVars) {
		const regex = new RegExp(`^${varName}=`, "m");
		if (!regex.test(content)) {
			if (content && !content.endsWith("\n")) {
				content += "\n";
			}
			content += `${varName}=\n`;
			added.push(varName);
		}
	}

	// Write if there were any changes
	if (created || added.length > 0) {
		fs.writeFileSync(envPath, content);
	}

	return { created, added };
}

// Step 1: Prepare .env.local with required vars from wrangler.jsonc
function prepareEnv() {
	try {
		const updates = prepareEnvLocal();
		if (updates.created) {
			console.log("✓ Created .env.local");
		}
		if (updates.added.length > 0) {
			console.log(`✓ Added missing env vars: ${updates.added.join(", ")}`);
		}
		if (!updates.created && updates.added.length === 0) {
			console.log("✓ .env.local file already has all required vars");
		}
	} catch (error) {
		console.error(String(error));
		process.exit(1);
	}
}

// Step 2: Run wrangler types
function runWranglerTypes() {
	console.log("Running wrangler types...");
	try {
		execSync("wrangler types -c wrangler.jsonc --env-file .env.local", {
			cwd,
			stdio: "inherit",
		});
		console.log("✓ Wrangler types generated");
	} catch {
		console.error("Failed to run wrangler types");
		process.exit(1);
	}
}

// Run all steps
try {
	prepareEnv();
	runWranglerTypes();
	console.log("\n✓ CF typegen completed successfully");
} catch (error: unknown) {
	console.error("\n✗ CF typegen failed:", error);
	process.exit(1);
}
