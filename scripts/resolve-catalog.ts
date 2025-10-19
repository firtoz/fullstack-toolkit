#!/usr/bin/env bun
/**
 * Script to resolve catalog: references in package.json files before publishing
 * This replaces all "catalog:" values with actual versions from the root package.json catalog
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Glob } from "bun";

interface PackageJson {
	catalog?: Record<string, string>;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
	optionalDependencies?: Record<string, string>;
	[key: string]: unknown;
}

const rootDir = join(import.meta.dir, "..");
const rootPackageJsonPath = join(rootDir, "package.json");

// Read root package.json to get the catalog
const rootPackageJson: PackageJson = JSON.parse(
	readFileSync(rootPackageJsonPath, "utf-8"),
);
const catalog = rootPackageJson.catalog || {};

console.log("📚 Catalog versions:");
for (const [pkg, version] of Object.entries(catalog)) {
	console.log(`  ${pkg}: ${version}`);
}
console.log();

// Find all package.json files in packages/
const glob = new Glob("packages/*/package.json");
const packageJsonFiles = Array.from(glob.scanSync({ cwd: rootDir })).map(
	(file) => join(rootDir, file),
);

let totalReplacements = 0;

for (const packageJsonPath of packageJsonFiles) {
	const packageJson: PackageJson = JSON.parse(
		readFileSync(packageJsonPath, "utf-8"),
	);
	const packageName = packageJson.name as string;
	let replacements = 0;

	// Helper function to resolve catalog references in a dependency section
	function resolveCatalogRefs(
		deps: Record<string, string> | undefined,
	): boolean {
		if (!deps) return false;
		let changed = false;

		for (const [dep, version] of Object.entries(deps)) {
			if (version === "catalog:") {
				const catalogVersion = catalog[dep];
				if (!catalogVersion) {
					console.error(
						`❌ Error: "${dep}" not found in catalog for ${packageName}`,
					);
					process.exit(1);
				}
				deps[dep] = catalogVersion;
				changed = true;
				replacements++;
			}
		}

		return changed;
	}

	// Process all dependency types
	let changed = false;
	changed = resolveCatalogRefs(packageJson.dependencies) || changed;
	changed = resolveCatalogRefs(packageJson.devDependencies) || changed;
	changed = resolveCatalogRefs(packageJson.peerDependencies) || changed;
	changed = resolveCatalogRefs(packageJson.optionalDependencies) || changed;

	if (changed) {
		// Write back with proper formatting
		writeFileSync(
			packageJsonPath,
			`${JSON.stringify(packageJson, null, "\t")}\n`,
			"utf-8",
		);
		console.log(
			`✅ ${packageName}: resolved ${replacements} catalog references`,
		);
		totalReplacements += replacements;
	}
}

if (totalReplacements === 0) {
	console.log("✨ No catalog references found - already resolved!");
} else {
	console.log(`\n✨ Total: resolved ${totalReplacements} catalog references`);
}
