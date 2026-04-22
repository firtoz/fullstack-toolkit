import { useConcurrentSubmitter, type RoutePath } from "@firtoz/router-toolkit";
import { useCallback, useState } from "react";
import { Link } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/plain-json-action-test";

export const formSchema = z.object({
	ping: z.string(),
});

export async function action({ request }: Route.ActionArgs): Promise<{
	kind: "plain";
	echo: string;
}> {
	const raw: unknown = await request.json();
	const parsed = formSchema.safeParse(raw);
	if (!parsed.success) {
		return { kind: "plain", echo: "invalid" };
	}
	return { kind: "plain", echo: parsed.data.ping };
}

export const route: RoutePath<"/router-toolkit/plain-json-action-test"> =
	"/router-toolkit/plain-json-action-test";

const PLAIN_PATH = "/router-toolkit/plain-json-action-test" as const;

export function meta() {
	return [
		{ title: "Plain JSON action - Test Playground" },
		{
			name: "description",
			content:
				"Non–formAction action + useConcurrentSubmitter submitJson await",
		},
	];
}

export default function PlainJsonActionTest() {
	const { submitJson } =
		useConcurrentSubmitter<typeof import("./plain-json-action-test")>();
	const [plainAwaitResult, setPlainAwaitResult] = useState("idle");

	const handleAwaitPlainJson = useCallback(async () => {
		setPlainAwaitResult("pending");
		try {
			const { promise } = submitJson(PLAIN_PATH, { ping: "hello-plain" });
			const data = await promise;
			if (data.kind === "plain" && data.echo === "hello-plain") {
				setPlainAwaitResult("await-plain-ok");
			} else {
				setPlainAwaitResult(`await-plain-unexpected:${JSON.stringify(data)}`);
			}
		} catch {
			setPlainAwaitResult("await-plain-error");
		}
	}, [submitJson]);

	return (
		<div>
			<Link to="/">← Back to Home</Link>
			<h1>Plain JSON action (concurrent submitter)</h1>
			<p>Action returns a custom object (not formAction / MaybeError).</p>
			<button type="button" onClick={handleAwaitPlainJson}>
				Await submitJson (plain)
			</button>
			<div data-testid="plain-json-await-result">{plainAwaitResult}</div>
		</div>
	);
}
