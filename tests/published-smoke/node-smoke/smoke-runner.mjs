/**
 * Dynamic import must run from this file (under node-smoke/) so Node resolves
 * `node_modules` next to the smoke project, not under ../shared/.
 *
 * @param {readonly string[]} packages
 * @param {Record<string, readonly string[]>} expectedExports
 * @returns {Promise<number>} exit code (0 = ok)
 */
export async function runSmoke(packages, expectedExports) {
	let failures = 0;

	for (const pkg of packages) {
		const expected = expectedExports[pkg];
		if (!expected || expected.length === 0) {
			console.error(`Missing EXPECTED_EXPORTS for ${pkg}`);
			failures++;
			continue;
		}

		let pkgFailed = false;
		try {
			const mod = await import(pkg);
			for (const name of expected) {
				if (!(name in mod)) {
					console.error(`${pkg}: missing export "${name}"`);
					pkgFailed = true;
					failures++;
				} else if (mod[name] === undefined) {
					console.error(`${pkg}: export "${name}" is undefined`);
					pkgFailed = true;
					failures++;
				}
			}
			if (!pkgFailed) {
				console.log(`ok ${pkg} (${expected.length} exports)`);
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			console.error(`FAIL load ${pkg}: ${message}`);
			failures++;
		}
	}

	if (failures > 0) {
		console.error(`\nSmoke failed: ${failures} error(s)`);
		return 1;
	}

	console.log(`\nAll ${packages.length} packages passed.`);
	return 0;
}
