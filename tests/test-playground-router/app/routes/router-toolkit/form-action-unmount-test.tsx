import { type RoutePath, useDynamicSubmitter } from "@firtoz/router-toolkit";
import { useCallback, useState } from "react";
import { Link } from "react-router";
import { classifySubmitterAwaitError } from "./form-action-test";

export { action, formSchema } from "./form-action-test";

export const route: RoutePath<"/router-toolkit/form-action-unmount-test"> =
	"/router-toolkit/form-action-unmount-test";

function SubmitterUnmountInner({
	onUnmount,
	onCatch,
}: {
	onUnmount: () => void;
	onCatch: (label: string) => void;
}) {
	const submitter = useDynamicSubmitter<
		typeof import("./form-action-unmount-test")
	>("/router-toolkit/form-action-unmount-test");

	const handleClick = useCallback(() => {
		void (async () => {
			try {
				const p = submitter.submitJson({
					name: "Unmount demo",
					email: "unmount@example.com",
					age: 22,
					terms: "on",
					intent: "slow",
				});
				setTimeout(() => {
					onUnmount();
				}, 0);
				await p;
				onCatch("unexpected-resolve");
			} catch (e: unknown) {
				onCatch(classifySubmitterAwaitError(e));
			}
		})();
	}, [submitter, onUnmount, onCatch]);

	return (
		<button
			type="button"
			data-testid="unmount-while-pending-button"
			onClick={handleClick}
		>
			Unmount while submitJson pending
		</button>
	);
}

export default function FormActionUnmountTest() {
	const [showInner, setShowInner] = useState(true);
	const [catchResult, setCatchResult] = useState("");

	return (
		<div>
			<Link to="/">← Back to Home</Link>
			<h1>Form action — unmount during await</h1>
			<p>
				Same action as form-action-test; separate route so the fetcher is not
				shared with other demos.
			</p>
			{showInner ? (
				<SubmitterUnmountInner
					onUnmount={() => setShowInner(false)}
					onCatch={setCatchResult}
				/>
			) : null}
			{!showInner && catchResult ? (
				<p data-testid="unmount-submitter-catch-result">{catchResult}</p>
			) : null}
		</div>
	);
}
