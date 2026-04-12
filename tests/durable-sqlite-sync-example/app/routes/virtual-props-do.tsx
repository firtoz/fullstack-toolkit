import { useEffect, useState } from "react";
import { VirtualPropsDoDemoClient } from "../components/virtual-props-do/VirtualPropsDoDemoClient";

export function meta() {
	return [
		{ title: "Virtual props + DO (TanStack vs Drizzle)" },
		{
			name: "description",
			content:
				"Query collection virtual props with GET/POST backed by Cloudflare Durable Objects",
		},
	];
}

/**
 * `useLiveQuery` uses `useSyncExternalStore` without `getServerSnapshot` — gate until mount.
 */
export default function VirtualPropsDoRoute() {
	const [hydrated, setHydrated] = useState(false);
	useEffect(() => {
		setHydrated(true);
	}, []);
	if (!hydrated) {
		return (
			<div style={{ padding: "1rem", maxWidth: 720 }}>
				<p>Loading demo…</p>
			</div>
		);
	}
	return <VirtualPropsDoDemoClient />;
}
