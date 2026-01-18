module.exports = {
	// Run Biome check with auto-fix on staged files
	"*.{js,jsx,ts,tsx,json,jsonc}": (filenames) => {
		const files = filenames.join(" ");
		return [
			// Run biome check with auto-fix and apply safe fixes
			`npx @biomejs/biome check --write --no-errors-on-unmatched ${files}`,
			// Stage the fixed files
			`git add ${files}`,
		];
	},
};
