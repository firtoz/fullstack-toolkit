import journal from "./meta/_journal.json";
import m0000 from "./0000_partial_people.sql";
import m0001 from "./0001_sync_changelog.sql";

export default {
	journal,
	migrations: {
		m0000,
		m0001,
	},
};
