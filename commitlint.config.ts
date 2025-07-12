import { execSync } from "node:child_process";
import type { UserConfig } from "@commitlint/types";

interface WorkspacePackage {
	name: string;
	version: string;
	location: string;
	// Other properties exist but we only need these
}

// Use npm query to discover workspace packages
function getWorkspacePackages(): string[] {
	try {
		const output = execSync("npm query .workspace", {
			encoding: "utf8",
			stdio: "pipe",
			cwd: __dirname,
		});

		const workspaces: WorkspacePackage[] = JSON.parse(output);

		// Extract package names from workspace data
		const packages = workspaces
			.map((pkg) => pkg.name) // Get full name like "@firtoz/maybe-error"
			.filter((name): name is string => name?.includes("/")) // Type guard + ensure it has a scope
			.map((name) => name.split("/")[1]); // Extract "maybe-error" from "@firtoz/maybe-error"

		console.log("✅ Found workspace packages:", packages);
		return packages;
	} catch (error) {
		console.warn("Could not detect workspace packages:", (error as Error).message);
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
		"header-max-length": [2, "always", 72],
		"body-leading-blank": [1, "always"],
		"body-max-line-length": [2, "always", 100],
		"footer-leading-blank": [1, "always"],
		"footer-max-line-length": [2, "always", 100],
	},
};

export default configuration; 