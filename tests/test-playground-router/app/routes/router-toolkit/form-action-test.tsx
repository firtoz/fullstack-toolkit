import { fail, success } from "@firtoz/maybe-error";
import {
	formAction,
	type RoutePath,
	SubmitterSupersededError,
	SubmitterUnmountedError,
	useDynamicSubmitter,
	useDynamicSubmitterFetcher,
} from "@firtoz/router-toolkit";
import { useCallback, useId, useState } from "react";
import { Link } from "react-router";
import { z } from "zod";

export const formSchema = z.object({
	name: z.string().min(2, "Name must be at least 2 characters"),
	email: z.email("Invalid email format"),
	age: z.coerce.number().min(18, "Must be at least 18 years old"),
	terms: z.literal("on").refine((val) => val === "on", {
		message: "You must accept the terms",
	}),
	/** Playground only: slow vs fast action for supersede / await demos */
	intent: z.enum(["slow", "fast"]).optional(),
});

export const action = formAction({
	schema: formSchema,
	handler: async (_args, data) => {
		const delayMs =
			data.intent === "slow" ? 2500 : data.intent === "fast" ? 80 : 1000;
		await new Promise((resolve) => setTimeout(resolve, delayMs));

		// Simulate business logic
		if (data.email === "admin@example.com") {
			return fail("Admin email is not allowed for registration");
		}

		return success({
			message: "Registration successful!",
			user: {
				id: Math.random().toString(36).slice(2, 11),
				name: data.name,
				email: data.email,
				age: data.age,
			},
		});
	},
});

export const route: RoutePath<"/router-toolkit/form-action-test"> =
	"/router-toolkit/form-action-test";

/** Stable tokens for E2E / debugging when `submitJson` rejects (not validation/handler payloads). */
export function classifySubmitterAwaitError(error: unknown): string {
	if (error instanceof SubmitterUnmountedError) {
		return "catch:SubmitterUnmountedError";
	}
	if (error instanceof SubmitterSupersededError) {
		return "catch:SubmitterSupersededError";
	}
	if (error instanceof Error) {
		return `catch:Error:${error.name}`;
	}
	return "catch:unknown";
}

export function meta() {
	return [
		{ title: "Form Action Test - Test Playground" },
		{
			name: "description",
			content: "Testing formAction utility with type-safe form handling",
		},
	];
}

const FORM_ACTION_PATH = "/router-toolkit/form-action-test" as const;

export default function FormActionTest() {
	const submitter =
		useDynamicSubmitter<typeof import("./form-action-test")>(FORM_ACTION_PATH);
	const fetcher = useDynamicSubmitterFetcher(submitter);

	const [awaitJsonStatus, setAwaitJsonStatus] = useState<
		"idle" | "pending" | string
	>("idle");
	const [supersedeFirst, setSupersedeFirst] = useState("");
	const [supersedeSecondEmail, setSupersedeSecondEmail] = useState("");
	const [supersedeBusy, setSupersedeBusy] = useState(false);

	const handleAwaitSubmitJson = useCallback(async () => {
		setAwaitJsonStatus("pending");
		try {
			const data = await submitter.submitJson({
				name: "Await Json",
				email: "await-json@example.com",
				age: 22,
				terms: "on",
			});
			setAwaitJsonStatus(
				data?.success ? "await-json-success" : "await-json-fail",
			);
		} catch (err: unknown) {
			setAwaitJsonStatus(classifySubmitterAwaitError(err));
		}
	}, [submitter]);

	const handleAwaitSubmitJsonHandlerFail = useCallback(async () => {
		setAwaitJsonStatus("pending");
		try {
			const data = await submitter.submitJson({
				name: "Admin Json",
				email: "admin@example.com",
				age: 30,
				terms: "on",
			});
			setAwaitJsonStatus(
				data?.success === false && data.error.type === "handler"
					? "await-json-fail-handler"
					: "await-json-unexpected",
			);
		} catch (err: unknown) {
			setAwaitJsonStatus(classifySubmitterAwaitError(err));
		}
	}, [submitter]);

	const handleAwaitSubmitJsonValidationFail = useCallback(async () => {
		setAwaitJsonStatus("pending");
		try {
			const data = await submitter.submitJson({
				name: "A",
				email: "valid-for-zod@example.com",
				age: 22,
				terms: "on",
			});
			setAwaitJsonStatus(
				data?.success === false && data.error.type === "validation"
					? "await-json-fail-validation"
					: "await-json-unexpected",
			);
		} catch (err: unknown) {
			setAwaitJsonStatus(classifySubmitterAwaitError(err));
		}
	}, [submitter]);

	const handleSupersedeDemo = useCallback(async () => {
		setSupersedeBusy(true);
		setSupersedeFirst("");
		setSupersedeSecondEmail("");
		const base = {
			name: "Supersede",
			age: 30,
			terms: "on" as const,
		};
		const p1 = submitter.submitJson({
			...base,
			email: "slow-supersede@example.com",
			intent: "slow",
		});
		const p2 = submitter.submitJson({
			...base,
			email: "fast-supersede@example.com",
			intent: "fast",
		});
		const firstOutcomeP = p1.then(
			() => "unexpected-resolve",
			(e: unknown) =>
				e instanceof SubmitterSupersededError ? "superseded" : "other-error",
		);
		try {
			const second = await p2;
			setSupersedeFirst(await firstOutcomeP);
			if (second?.success && second.result) {
				setSupersedeSecondEmail(second.result.user.email);
			} else {
				setSupersedeSecondEmail("fail");
			}
		} finally {
			setSupersedeBusy(false);
		}
	}, [submitter]);

	const nameId = useId();
	const emailId = useId();
	const ageId = useId();
	const termsId = useId();
	const awaitBusy = awaitJsonStatus === "pending" || fetcher.state !== "idle";

	return (
		<div>
			<Link to="/">← Back to Home</Link>
			<h1>Form Action Test</h1>
			<p>
				Testing the formAction utility with Zod validation and type-safe error
				handling
			</p>

			<submitter.Form method="post">
				<div>
					<label htmlFor={nameId}>Name:</label>
					<input id={nameId} name="name" type="text" required />
				</div>

				<div>
					<label htmlFor={emailId}>Email:</label>
					<input id={emailId} name="email" type="email" required />
				</div>

				<div>
					<label htmlFor={ageId}>Age:</label>
					<input id={ageId} name="age" type="number" required min={18} />
				</div>

				<div>
					<input id={termsId} name="terms" type="checkbox" required />
					<label htmlFor={termsId}>I accept the terms and conditions</label>
				</div>

				<button type="submit" disabled={fetcher.state === "submitting"}>
					{fetcher.state === "submitting" ? "Registering..." : "Register"}
				</button>
			</submitter.Form>

			<div>
				<h2>Fetcher State (useDynamicSubmitterFetcher):</h2>
				<pre>{JSON.stringify({ state: fetcher.state }, null, 2)}</pre>
			</div>

			{fetcher.data && (
				<div>
					<h2>Action Result:</h2>
					<pre>{JSON.stringify(fetcher.data, null, 2)}</pre>

					{fetcher.data.success ? (
						<div>
							<p>✅ Registration successful!</p>
							{fetcher.data.result && (
								<div>
									<p>
										Welcome, {fetcher.data.result.user.name}! User ID:{" "}
										{fetcher.data.result.user.id}
									</p>
								</div>
							)}
						</div>
					) : (
						<div>
							<p>❌ Registration failed</p>
							{fetcher.data.error.type === "validation" && (
								<div>
									<p>Validation errors:</p>
									<pre>{JSON.stringify(fetcher.data.error.error, null, 2)}</pre>
								</div>
							)}
							{fetcher.data.error.type === "handler" && (
								<div>
									<p>Error: {fetcher.data.error.error}</p>
								</div>
							)}
							{fetcher.data.error.type === "unknown" && (
								<div>
									<p>An unexpected error occurred. Please try again.</p>
								</div>
							)}
						</div>
					)}
				</div>
			)}

			<div>
				<h2>Programmatic submitJson (await)</h2>
				<p>
					Calls <code>await submitter.submitJson(...)</code> and surfaces the
					settled result for E2E.
				</p>
				<button
					type="button"
					data-testid="await-submit-json-button"
					disabled={awaitBusy}
					onClick={() => void handleAwaitSubmitJson()}
				>
					{awaitJsonStatus === "pending"
						? "Awaiting submitJson…"
						: "Run await submitJson"}
				</button>
				<button
					type="button"
					data-testid="await-submit-json-handler-fail-button"
					disabled={awaitBusy}
					onClick={() => void handleAwaitSubmitJsonHandlerFail()}
				>
					Await submitJson (handler fail)
				</button>
				<button
					type="button"
					data-testid="await-submit-json-validation-fail-button"
					disabled={awaitBusy}
					onClick={() => void handleAwaitSubmitJsonValidationFail()}
				>
					Await submitJson (validation fail)
				</button>
				{awaitJsonStatus !== "idle" && awaitJsonStatus !== "pending" ? (
					<p data-testid="await-submit-json-result">{awaitJsonStatus}</p>
				) : null}
			</div>

			<div>
				<h2>Supersede demo</h2>
				<p>
					Fires a slow <code>submitJson</code> then a fast one without awaiting
					the first; the first promise should reject with{" "}
					<code>SubmitterSupersededError</code>.
				</p>
				<button
					type="button"
					data-testid="supersede-demo-button"
					disabled={supersedeBusy || fetcher.state !== "idle"}
					onClick={() => void handleSupersedeDemo()}
				>
					{supersedeBusy ? "Running…" : "Run supersede demo"}
				</button>
				{supersedeFirst ? (
					<p data-testid="supersede-first-outcome">{supersedeFirst}</p>
				) : null}
				{supersedeSecondEmail ? (
					<p data-testid="supersede-second-email">{supersedeSecondEmail}</p>
				) : null}
			</div>

			<div>
				<h3>Test Cases:</h3>
				<ul>
					<li>• Try submitting with invalid email format</li>
					<li>• Try submitting with age less than 18</li>
					<li>• Try submitting without accepting terms</li>
					<li>
						• Try submitting with email "admin@example.com" (business logic
						error)
					</li>
					<li>• Submit valid data to see success response</li>
				</ul>
			</div>
		</div>
	);
}
