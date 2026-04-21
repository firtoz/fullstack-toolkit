import {
	formAction,
	type RoutePath,
	useDynamicSubmitter,
	useDynamicSubmitterFetcher,
} from "@firtoz/router-toolkit";
import { success } from "@firtoz/maybe-error";
import { useCallback, useState } from "react";
import { Link } from "react-router";
import { z } from "zod";

/**
 * E2E: two `useDynamicSubmitter` instances with **no** `keySuffix` share one React Router
 * fetcher key; overlapping `submitJson` should supersede the earlier promise (any instance).
 */
export const formSchema = z.object({
	which: z.enum(["a", "b"]),
});

export const action = formAction({
	schema: formSchema,
	handler: async (_args, data) => {
		await new Promise((r) => setTimeout(r, 400));
		return success({ which: data.which, at: Date.now() });
	},
});

export const route: RoutePath<"/router-toolkit/shared-fetcher-key-dual-submitter-test"> =
	"/router-toolkit/shared-fetcher-key-dual-submitter-test";

type Module = typeof import("./shared-fetcher-key-dual-submitter-test");

function DualPanel({ label, which }: { label: string; which: "a" | "b" }) {
	const submitter = useDynamicSubmitter<Module>(route);
	const fetcher = useDynamicSubmitterFetcher(submitter);
	const [awaitResult, setAwaitResult] = useState("");

	const fire = useCallback(() => {
		void (async () => {
			try {
				const d = await submitter.submitJson({ which });
				if (d?.success) {
					setAwaitResult(`ok:which=${d.result.which}`);
				} else {
					setAwaitResult("fail:payload");
				}
			} catch (e: unknown) {
				setAwaitResult(e instanceof Error ? `err:${e.name}` : "err:unknown");
			}
		})();
	}, [submitter, which]);

	return (
		<div data-testid={`shared-dual-panel-${which}`}>
			<h3>{label}</h3>
			<p data-testid={`shared-dual-fetcher-state-${which}`}>{fetcher.state}</p>
			<pre data-testid={`shared-dual-fetcher-data-${which}`}>
				{fetcher.data === undefined
					? "undefined"
					: JSON.stringify(fetcher.data)}
			</pre>
			<button
				type="button"
				data-testid={`shared-dual-fire-${which}`}
				onClick={fire}
			>
				Fire {which.toUpperCase()}
			</button>
			<p data-testid={`shared-dual-await-${which}`}>{awaitResult}</p>
		</div>
	);
}

export default function SharedFetcherKeyDualSubmitterTest() {
	return (
		<div>
			<Link to="/">← Back to Home</Link>
			<h1>Dual submitter (shared fetcher key)</h1>
			<p>
				Two submitters use the default fetcher key (no <code>keySuffix</code>),
				so they share <code>fetcher.state</code> / <code>fetcher.data</code>.
				Overlapping submits should reject the earlier promise with{" "}
				<code>SubmitterSupersededError</code>.
			</p>
			<div style={{ display: "flex", gap: "2rem" }}>
				<DualPanel label="Pane A" which="a" />
				<DualPanel label="Pane B" which="b" />
			</div>
		</div>
	);
}
