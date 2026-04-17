import { Welcome } from "../welcome/welcome";

export function meta() {
	return [
		{ title: "Test Playground — collections" },
		{
			name: "description",
			content: "Collections, IndexedDB, SQLite, and related demos",
		},
	];
}

export default function Home() {
	return (
		<div>
			<h1>Test Playground (collections)</h1>
			<p>IndexedDB, SQLite, sync modes, pagination, and related demos</p>
			<Welcome />
		</div>
	);
}
