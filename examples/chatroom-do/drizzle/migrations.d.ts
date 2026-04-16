declare const migrations: {
	journal: {
		version: string;
		dialect: string;
		entries: {
			idx: number;
			version: string;
			when: number;
			tag: string;
			breakpoints: boolean;
		}[];
	};
	migrations: Record<string, string>;
};

export default migrations;
