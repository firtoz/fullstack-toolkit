import { fail, success } from "@firtoz/maybe-error";
import {
	formAction,
	type RoutePath,
	useDynamicSubmitter,
} from "@firtoz/router-toolkit";
import { useId } from "react";
import { Link } from "react-router";
import { z } from "zod";

export const formSchema = z.object({
	name: z.string().min(2, "Name must be at least 2 characters"),
	email: z.email("Invalid email format"),
	age: z.coerce.number().min(18, "Must be at least 18 years old"),
	terms: z.literal("on").refine((val) => val === "on", {
		message: "You must accept the terms",
	}),
});

export const action = formAction({
	schema: formSchema,
	handler: async (_args, data) => {
		// Simulate processing delay
		await new Promise((resolve) => setTimeout(resolve, 1000));

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

export function meta() {
	return [
		{ title: "Form Action Test - Test Playground" },
		{
			name: "description",
			content: "Testing formAction utility with type-safe form handling",
		},
	];
}

export default function FormActionTest() {
	const submitter = useDynamicSubmitter<typeof import("./form-action-test")>(
		"/router-toolkit/form-action-test",
	);

	const nameId = useId();
	const emailId = useId();
	const ageId = useId();
	const termsId = useId();

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

				<button type="submit" disabled={submitter.state === "submitting"}>
					{submitter.state === "submitting" ? "Registering..." : "Register"}
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
							<p>✅ Registration successful!</p>
							{submitter.data.result && (
								<div>
									<p>
										Welcome, {submitter.data.result.user.name}! User ID:{" "}
										{submitter.data.result.user.id}
									</p>
								</div>
							)}
						</div>
					) : (
						<div>
							<p>❌ Registration failed</p>
							{submitter.data.error.type === "validation" && (
								<div>
									<p>Validation errors:</p>
									<pre>
										{JSON.stringify(submitter.data.error.error, null, 2)}
									</pre>
								</div>
							)}
							{submitter.data.error.type === "handler" && (
								<div>
									<p>Error: {submitter.data.error.error}</p>
								</div>
							)}
							{submitter.data.error.type === "unknown" && (
								<div>
									<p>An unexpected error occurred. Please try again.</p>
								</div>
							)}
						</div>
					)}
				</div>
			)}

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
