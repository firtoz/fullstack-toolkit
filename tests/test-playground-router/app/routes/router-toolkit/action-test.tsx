import { type RoutePath, useDynamicSubmitter } from "@firtoz/router-toolkit";
import { useId } from "react";
import { Link } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/action-test";

interface ActionData {
	success: boolean;
	message: string;
	submittedData?: {
		name: string;
		email: string;
	};
}

export async function action({
	request,
}: Route.ActionArgs): Promise<ActionData> {
	const formData = await request.formData();
	const name = formData.get("name") as string;
	const email = formData.get("email") as string;

	// Simulate processing delay
	await new Promise((resolve) => setTimeout(resolve, 1000));

	// Simple validation
	if (!name || !email) {
		return {
			success: false,
			message: "Name and email are required",
		};
	}

	return {
		success: true,
		message: "Form submitted successfully!",
		submittedData: { name, email },
	};
}

export function meta() {
	return [
		{ title: "Action Test - Test Playground" },
		{ name: "description", content: "Testing useDynamicSubmitter hook" },
	];
}

export const route: RoutePath<"/router-toolkit/action-test"> =
	"/router-toolkit/action-test";

export const formSchema = z.object({
	name: z.string().min(1),
	email: z.email(),
});

export default function ActionTest() {
	const submitter = useDynamicSubmitter<typeof import("./action-test")>(
		"/router-toolkit/action-test",
	);

	const nameId = useId();
	const emailId = useId();

	return (
		<div>
			<Link to="/">← Back to Home</Link>
			<h1>Action Test</h1>
			<p>Testing React Router form actions</p>

			<submitter.Form method="post">
				<div>
					<label htmlFor={nameId}>Name:</label>
					<input id={nameId} name="name" type="text" required />
				</div>

				<div>
					<label htmlFor={emailId}>Email:</label>
					<input id={emailId} name="email" type="email" required />
				</div>

				<button type="submit" disabled={submitter.state === "submitting"}>
					{submitter.state === "submitting" ? "Submitting..." : "Submit"}
				</button>
			</submitter.Form>

			<div>
				<h2>Fetcher State:</h2>
				<pre>{JSON.stringify({ state: submitter.state }, null, 2)}</pre>
			</div>

			{submitter.data && (
				<div>
					<h2>Action Result:</h2>
					<pre>{JSON.stringify(submitter.data, null, 2)}</pre>

					{submitter.data.success ? (
						<div>
							<p>✅ {submitter.data.message}</p>
						</div>
					) : (
						<div>
							<p>❌ {submitter.data.message}</p>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
