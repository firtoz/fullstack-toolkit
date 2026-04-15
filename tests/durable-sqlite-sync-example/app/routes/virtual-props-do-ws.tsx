import { useEffect, useState } from "react";
import { VirtualPropsDoWsDemoClient } from "../components/virtual-props-do/VirtualPropsDoWsDemoClient";

export function meta() {
	return [{ title: "Virtual props + DO (WebSocket)" }];
}

/**
 * `useLiveQuery` uses `useSyncExternalStore` without `getServerSnapshot` — gate until mount.
 */
export default function VirtualPropsDoWsRoute() {
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
	return <VirtualPropsDoWsDemoClient />;
}
