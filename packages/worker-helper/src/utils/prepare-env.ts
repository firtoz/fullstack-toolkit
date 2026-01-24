import * as fs from "node:fs";
import path from "node:path";

/**
 * Ensures a .env and .env.local file exists in the target directory.
 * If it doesn't exist, copies from .env.example and .env.local.example.
 *
 * @param targetDir - The directory where the .env and .env.local files should exist
 * @returns An array of the files that were created or already existed
 */
export function prepareEnvFiles(targetDir: string): string[] {
	const exampleEnvPath = path.join(targetDir, ".env.example");
	const exampleEnvLocalPath = path.join(targetDir, ".env.local.example");

	const exampleEnvExists = fs.existsSync(exampleEnvPath);
	const exampleLocalEnvExists = fs.existsSync(exampleEnvLocalPath);

	const envPath = path.join(targetDir, ".env");
	const envLocalPath = path.join(targetDir, ".env.local");

	let envExists = fs.existsSync(envPath);
	let envLocalExists = fs.existsSync(envLocalPath);

	if (exampleEnvExists) {
		if (!envExists) {
			fs.cpSync(exampleEnvPath, envPath);

			console.log("✓ Created .env from .env.example");
			envExists = true;
		}
	}

	if (exampleLocalEnvExists) {
		if (!envLocalExists) {
			fs.cpSync(exampleEnvLocalPath, envLocalPath);

			console.log("✓ Created .env.local from .env.local.example");
			envLocalExists = true;
		}
	}

	const result: string[] = [];
	// The order matters, because latter files' values will override former files' values
	if (exampleEnvExists) {
		result.push(".env.example");
	}
	if (exampleLocalEnvExists) {
		result.push(".env.local.example");
	}
	if (envExists) {
		result.push(".env");
	}
	if (envLocalExists) {
		result.push(".env.local");
	}

	return result;
}
