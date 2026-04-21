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
 * Minimal action for E2E: two `useDynamicSubmitter` instances with different `keySuffix`
 * can overlap without superseding each other.
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

export const route: RoutePath<"/router-toolkit/key-suffix-dual-submitter-test"> =
	"/router-toolkit/key-suffix-dual-submitter-test";

type Module = typeof import("./key-suffix-dual-submitter-test");

function DualPanel({
	label,
	keySuffix,
	which,
}: {
	label: string;
	keySuffix: string;
	which: "a" | "b";
}) {
	const submitter = useDynamicSubmitter<Module>(route, { keySuffix });
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
		<div data-testid={`dual-panel-${which}`}>
			<h3>{label}</h3>
			<p data-testid={`dual-fetcher-state-${which}`}>{fetcher.state}</p>
			<button type="button" data-testid={`dual-fire-${which}`} onClick={fire}>
				Fire {which.toUpperCase()}
			</button>
			<p data-testid={`dual-await-${which}`}>{awaitResult}</p>
		</div>
	);
}

export default function KeySuffixDualSubmitterTest() {
	return (
		<div>
			<Link to="/">← Back to Home</Link>
			<h1>Dual submitter (keySuffix)</h1>
			<p>
				Two submitters target the same route with different{" "}
				<code>keySuffix</code> so overlapping <code>submitJson</code> calls
				should both resolve.
			</p>
			<div style={{ display: "flex", gap: "2rem" }}>
				<DualPanel label="Pane A" keySuffix="e2e-pane-a" which="a" />
				<DualPanel label="Pane B" keySuffix="e2e-pane-b" which="b" />
			</div>
		</div>
	);
}
