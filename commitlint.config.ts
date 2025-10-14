import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { UserConfig } from "@commitlint/types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface PackageJson {
	name?: string;
	workspaces?: string[];
}

// Discover workspace packages by reading root package.json and scanning workspace globs
function getWorkspacePackages(): string[] {
	try {
		// Read root package.json
		const rootPkgPath = join(__dirname, "package.json");
		const rootPkg: PackageJson = JSON.parse(readFileSync(rootPkgPath, "utf8"));

		if (!rootPkg.workspaces || rootPkg.workspaces.length === 0) {
			console.warn("No workspaces defined in package.json");
			return [];
		}

		const packages: string[] = [];

		// For each workspace glob pattern
		for (const workspaceGlob of rootPkg.workspaces) {
			// Convert glob pattern to actual paths (e.g., "packages/*" -> "packages/*/package.json")
			const pattern = join(__dirname, workspaceGlob, "package.json");

			// Use sync glob from fs
			const { globSync } = require("node:fs");
			const pkgJsonPaths = globSync(pattern);

			// Read each package.json and extract the name
			for (const pkgPath of pkgJsonPaths) {
				try {
					const pkg: PackageJson = JSON.parse(readFileSync(pkgPath, "utf8"));
					if (pkg.name) {
						// Extract "maybe-error" from "@firtoz/maybe-error"
						const shortName = pkg.name.includes("/")
							? pkg.name.split("/")[1]
							: pkg.name;
						packages.push(shortName);
					}
				} catch (err) {
					console.warn(`Could not read ${pkgPath}:`, (err as Error).message);
				}
			}
		}

		console.log("✅ Found workspace packages:", packages);
		return packages;
	} catch (error) {
		console.warn(
			"Could not detect workspace packages:",
			(error as Error).message,
		);
		return [];
	}
}

// Get valid scopes from workspace packages
const workspacePackages = getWorkspacePackages();

const configuration: UserConfig = {
	extends: ["@commitlint/config-conventional"],
	ignores: [
		// Ignore semantic-release commits
		(commit) => commit.includes("chore(release)"),
		// Ignore merge commits
		(commit) => commit.includes("Merge branch"),
		(commit) => commit.includes("Merge pull request"),
	],
	rules: {
		"type-enum": [
			2,
			"always",
			[
				"feat", // New features
				"fix", // Bug fixes
				"docs", // Documentation changes
				"style", // Code style changes (formatting, etc.)
				"refactor", // Code refactoring
				"perf", // Performance improvements
				"test", // Adding or updating tests
				"build", // Build system changes
				"ci", // CI/CD changes
				"chore", // Maintenance tasks
				"revert", // Reverting commits
			],
		],
		"scope-enum": [
			2,
			"always",
			workspacePackages, // 🚀 npm query workspace discovery!
		],
		"type-case": [2, "always", "lower-case"],
		"type-empty": [2, "never"],
		"scope-case": [2, "always", "lower-case"],
		"subject-case": [
			2,
			"never",
			["sentence-case", "start-case", "pascal-case", "upper-case"],
		],
		"subject-empty": [2, "never"],
		"subject-full-stop": [2, "never", "."],
		// Line length rules disabled - only check conventional commit format
		"header-max-length": [0],
		"body-leading-blank": [1, "always"],
		"body-max-line-length": [0],
		"footer-leading-blank": [1, "always"],
		"footer-max-line-length": [0],
	},
};

export default configuration;
