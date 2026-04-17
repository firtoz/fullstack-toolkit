import { Welcome } from "../welcome/welcome";

export function meta() {
	return [
		{ title: "Test Playground — router-toolkit" },
		{
			name: "description",
			content: "Router toolkit hooks and form demos",
		},
	];
}

export default function Home() {
	return (
		<div>
			<h1>Test Playground (router-toolkit)</h1>
			<p>Loaders, actions, fetchers, and form helpers</p>
			<Welcome />
		</div>
	);
}
