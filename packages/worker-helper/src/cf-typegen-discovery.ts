import * as fs from "node:fs";
import path from "node:path";

/**
 * Find workspace root by walking up from startPath until we find a package.json
 * with a "workspaces" field (npm/bun convention).
 */
export function findWorkspaceRoot(startPath: string): string | null {
	let dir = path.resolve(startPath);
	for (;;) {
		const pkgPath = path.join(dir, "package.json");
		if (fs.existsSync(pkgPath)) {
			try {
				const content = fs.readFileSync(pkgPath, "utf8");
				const pkg = JSON.parse(content) as { workspaces?: unknown };
				if (
					pkg.workspaces != null &&
					(Array.isArray(pkg.workspaces) ||
						(typeof pkg.workspaces === "object" &&
							"packages" in pkg.workspaces))
				) {
					return dir;
				}
			} catch {
				// ignore parse errors
			}
		}
		const parent = path.dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	return null;
}

/**
 * Expand workspace glob patterns (e.g. "packages/*", "tests/*") to absolute paths.
 * Only supports single-level globs; each pattern must be exactly "dirname/*".
 */
export function expandWorkspacePatterns(
	root: string,
	patterns: string[],
): string[] {
	const dirs: string[] = [];
	for (const pattern of patterns) {
		if (!pattern.endsWith("/*")) continue;
		const base = pattern.slice(0, -2);
		const basePath = path.join(root, base);
		try {
			const entries = fs.readdirSync(basePath, { withFileTypes: true });
			for (const e of entries) {
				if (e.isDirectory()) {
					dirs.push(path.join(basePath, e.name));
				}
			}
		} catch {
			// base path may not exist
		}
	}
	return dirs;
}

/**
 * Get workspace package paths from root package.json (workspaces field).
 * Returns absolute paths to each workspace member directory.
 */
export function getWorkspacePaths(root: string): string[] {
	const pkgPath = path.join(root, "package.json");
	try {
		const content = fs.readFileSync(pkgPath, "utf8");
		const pkg = JSON.parse(content) as {
			workspaces?: string[] | { packages?: string[] };
		};
		const raw = Array.isArray(pkg.workspaces)
			? pkg.workspaces
			: pkg.workspaces?.packages;
		if (!Array.isArray(raw)) return [];
		return expandWorkspacePatterns(root, raw);
	} catch {
		return [];
	}
}

/**
 * Find all wrangler config files under the given workspace member paths.
 * Does not rely on git; includes untracked configs (e.g. new durable objects).
 */
export function findWranglerConfigsInPaths(workspacePaths: string[]): string[] {
	const results: string[] = [];
	for (const dir of workspacePaths) {
		for (const name of ["wrangler.json", "wrangler.jsonc"]) {
			const fullPath = path.join(dir, name);
			if (fs.existsSync(fullPath)) {
				results.push(fullPath);
				break; // at most one per dir
			}
		}
	}
	return results.sort((a, b) => (a < b ? -1 : 1));
}

/**
 * Discover all wrangler config paths for the workspace containing cwd.
 * Returns empty array if not in a workspace or if root has no workspaces field.
 */
export function discoverWranglerConfigs(cwd: string): string[] {
	const workspaceRoot = findWorkspaceRoot(cwd);
	if (!workspaceRoot) return [];
	const workspacePaths = getWorkspacePaths(workspaceRoot);
	return findWranglerConfigsInPaths(workspacePaths);
}
