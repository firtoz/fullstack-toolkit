import {
	discoverWranglerConfigs,
	expandWorkspacePatterns,
	findWranglerConfigsInPaths,
	findWorkspaceRoot,
	getWorkspacePaths,
} from "../src/cf-typegen-discovery";
import { describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

function mkdirp(dir: string): void {
	fs.mkdirSync(dir, { recursive: true });
}

describe("cf-typegen-discovery", () => {
	it("findWorkspaceRoot returns root when cwd is workspace member", () => {
		const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cf-typegen-"));
		try {
			const rootPkg = path.join(tmp, "package.json");
			fs.writeFileSync(
				rootPkg,
				JSON.stringify({ workspaces: ["packages/*"] }),
			);
			mkdirp(path.join(tmp, "packages", "foo"));
			const fromPackage = path.join(tmp, "packages", "foo");
			expect(findWorkspaceRoot(fromPackage)).toBe(tmp);
		} finally {
			fs.rmSync(tmp, { recursive: true, force: true });
		}
	});

	it("findWorkspaceRoot returns root when cwd is workspace root", () => {
		const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cf-typegen-"));
		try {
			fs.writeFileSync(
				path.join(tmp, "package.json"),
				JSON.stringify({ workspaces: ["packages/*"] }),
			);
			expect(findWorkspaceRoot(tmp)).toBe(tmp);
		} finally {
			fs.rmSync(tmp, { recursive: true, force: true });
		}
	});

	it("findWorkspaceRoot returns null when no package.json has workspaces", () => {
		const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cf-typegen-"));
		try {
			fs.writeFileSync(
				path.join(tmp, "package.json"),
				JSON.stringify({ name: "foo" }),
			);
			expect(findWorkspaceRoot(tmp)).toBe(null);
		} finally {
			fs.rmSync(tmp, { recursive: true, force: true });
		}
	});

	it("findWorkspaceRoot accepts workspaces.packages object form", () => {
		const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cf-typegen-"));
		try {
			fs.writeFileSync(
				path.join(tmp, "package.json"),
				JSON.stringify({ workspaces: { packages: ["packages/*"] } }),
			);
			expect(findWorkspaceRoot(tmp)).toBe(tmp);
		} finally {
			fs.rmSync(tmp, { recursive: true, force: true });
		}
	});

	it("expandWorkspacePatterns expands dirname/* to direct child dirs", () => {
		const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cf-typegen-"));
		try {
			mkdirp(path.join(tmp, "packages", "a"));
			mkdirp(path.join(tmp, "packages", "b"));
			mkdirp(path.join(tmp, "durable-objects", "fal-user-do"));
			const got = expandWorkspacePatterns(tmp, [
				"packages/*",
				"durable-objects/*",
			]);
			expect(got.length).toBe(3);
			expect(got).toContain(path.join(tmp, "packages", "a"));
			expect(got).toContain(path.join(tmp, "packages", "b"));
			expect(got).toContain(path.join(tmp, "durable-objects", "fal-user-do"));
		} finally {
			fs.rmSync(tmp, { recursive: true, force: true });
		}
	});

	it("getWorkspacePaths returns paths from root package.json workspaces", () => {
		const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cf-typegen-"));
		try {
			fs.writeFileSync(
				path.join(tmp, "package.json"),
				JSON.stringify({
					workspaces: ["packages/*", "durable-objects/*"],
				}),
			);
			mkdirp(path.join(tmp, "packages", "worker"));
			mkdirp(path.join(tmp, "durable-objects", "fal-user-do"));
			const got = getWorkspacePaths(tmp);
			expect(got.length).toBe(2);
			expect(got).toContain(path.join(tmp, "packages", "worker"));
			expect(got).toContain(path.join(tmp, "durable-objects", "fal-user-do"));
		} finally {
			fs.rmSync(tmp, { recursive: true, force: true });
		}
	});

	it("findWranglerConfigsInPaths returns only dirs that have wrangler.json or wrangler.jsonc", () => {
		const dirs = [
			path.join(os.tmpdir(), "cf-typegen-a"),
			path.join(os.tmpdir(), "cf-typegen-b"),
			path.join(os.tmpdir(), "cf-typegen-c"),
		];
		try {
			for (const d of dirs) mkdirp(d);
			fs.writeFileSync(path.join(dirs[0], "wrangler.jsonc"), "{}");
			fs.writeFileSync(path.join(dirs[2], "wrangler.json"), "{}");
			const got = findWranglerConfigsInPaths(dirs);
			expect(got.length).toBe(2);
			expect(got).toContain(path.join(dirs[0], "wrangler.jsonc"));
			expect(got).toContain(path.join(dirs[2], "wrangler.json"));
		} finally {
			for (const d of dirs) {
				try {
					fs.rmSync(d, { recursive: true, force: true });
				} catch {
					// ignore
				}
			}
		}
	});

	it("discoverWranglerConfigs finds all wrangler configs in workspace including untracked packages", () => {
		const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cf-typegen-"));
		try {
			fs.writeFileSync(
				path.join(tmp, "package.json"),
				JSON.stringify({
					workspaces: ["packages/*", "durable-objects/*"],
				}),
			);
			mkdirp(path.join(tmp, "packages", "app"));
			mkdirp(path.join(tmp, "durable-objects", "fal-user-do"));
			fs.writeFileSync(
				path.join(tmp, "packages", "app", "wrangler.jsonc"),
				"{}",
			);
			fs.writeFileSync(
				path.join(tmp, "durable-objects", "fal-user-do", "wrangler.jsonc"),
				"{}",
			);
			const cwd = path.join(tmp, "packages", "app");
			const got = discoverWranglerConfigs(cwd);
			expect(got.length).toBe(2);
			expect(got).toContain(
				path.join(tmp, "packages", "app", "wrangler.jsonc"),
			);
			expect(got).toContain(
				path.join(tmp, "durable-objects", "fal-user-do", "wrangler.jsonc"),
			);
		} finally {
			fs.rmSync(tmp, { recursive: true, force: true });
		}
	});

	it("discoverWranglerConfigs returns empty when not in a workspace", () => {
		const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cf-typegen-"));
		try {
			mkdirp(path.join(tmp, "some", "nested", "dir"));
			expect(discoverWranglerConfigs(path.join(tmp, "some", "nested", "dir"))).toEqual([]);
		} finally {
			fs.rmSync(tmp, { recursive: true, force: true });
		}
	});
});
