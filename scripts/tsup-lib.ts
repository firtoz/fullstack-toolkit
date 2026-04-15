/**
 * Shared tsup configuration for workspace libraries: one ESM entry per source file under
 * `src/` (excluding tests), with DTS, code splitting, and npm/workspace externals.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { Options } from "tsup";

function walkSourceFiles(dir: string, out: string[]): void {
	for (const name of readdirSync(dir)) {
		const full = join(dir, name);
		const st = statSync(full);
		if (st.isDirectory()) {
			walkSourceFiles(full, out);
		} else if (
			(name.endsWith(".ts") || name.endsWith(".tsx")) &&
			!name.endsWith(".test.ts") &&
			!name.endsWith(".test.tsx")
		) {
			out.push(full);
		}
	}
}

/** Paths relative to `packageDir` using `/`, without extension — e.g. `index`, `types/Foo`. */
export function sourceEntriesFromPackageDir(packageDir: string): Record<string, string> {
	const srcDir = join(packageDir, "src");
	const files: string[] = [];
	walkSourceFiles(srcDir, files);
	const entry: Record<string, string> = {};
	for (const full of files) {
		const rel = relative(packageDir, full).replace(/\\/g, "/");
		if (!rel.startsWith("src/")) continue;
		const key = rel.slice("src/".length).replace(/\.tsx?$/, "");
		entry[key] = full;
	}
	if (Object.keys(entry).length === 0) {
		throw new Error(`tsup-lib: no source files under ${srcDir}`);
	}
	return entry;
}

export function npmExternalPackageNames(packageJsonPath: string): string[] {
	const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
		dependencies?: Record<string, string>;
		peerDependencies?: Record<string, string>;
		optionalDependencies?: Record<string, string>;
	};
	return [
		...Object.keys(pkg.dependencies ?? {}),
		...Object.keys(pkg.peerDependencies ?? {}),
		...Object.keys(pkg.optionalDependencies ?? {}),
	];
}

export function createLibTsupOptions(packageDir: string, overrides?: Partial<Options>): Options {
	const pkgPath = join(packageDir, "package.json");
	const pkgJson = JSON.parse(readFileSync(pkgPath, "utf8")) as {
		name?: string;
		dependencies?: Record<string, string>;
		peerDependencies?: Record<string, string>;
		optionalDependencies?: Record<string, string>;
	};
	const external = new Set([
		...Object.keys(pkgJson.dependencies ?? {}),
		...Object.keys(pkgJson.peerDependencies ?? {}),
		...Object.keys(pkgJson.optionalDependencies ?? {}),
	]);
	if (typeof pkgJson.name === "string") {
		external.add(pkgJson.name);
	}
	external.add("react");
	external.add("react/jsx-runtime");
	external.add("react-dom");
	external.add("react-dom/client");
	external.add("cloudflare:workers");

	const base: Options = {
		entry: sourceEntriesFromPackageDir(packageDir),
		format: ["esm"],
		dts: {
			compilerOptions: {
				ignoreDeprecations: "6.0",
			},
		},
		outDir: join(packageDir, "dist"),
		clean: true,
		sourcemap: true,
		splitting: true,
		treeshake: true,
		target: "es2020",
		platform: "neutral",
		bundle: true,
		external: [...external],
		esbuildOptions(options) {
			options.jsx = "automatic";
		},
	};

	if (!overrides) {
		return base;
	}

	const { esbuildOptions: userEsbuild, ...rest } = overrides;
	return {
		...base,
		...rest,
		esbuildOptions:
			userEsbuild === undefined
				? base.esbuildOptions
				: (options, context) => {
						base.esbuildOptions?.(options, context);
						userEsbuild(options, context);
					},
	};
}
