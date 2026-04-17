import { type RoutePath, useDynamicSubmitter } from "@firtoz/router-toolkit";
import { useId } from "react";
import { Link, useLoaderData } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/submitter-with-loader";

interface User {
	id: number;
	name: string;
	email: string;
	lastUpdated: string;
}

interface LoaderData {
	user: User;
}

type ActionData = {
	success: boolean;
	message: string;
	updatedUser?: User;
};

export const loader = async (): Promise<LoaderData> => {
	// Simulate API call delay
	await new Promise((resolve) => setTimeout(resolve, 300));

	return {
		user: {
			id: 1,
			name: "John Doe",
			email: "john@example.com",
			lastUpdated: new Date().toISOString(),
		},
	};
};

export async function action({
	request,
}: Route.ActionArgs): Promise<ActionData> {
	const formData = await request.formData();
	const name = formData.get("name") as string;
	const email = formData.get("email") as string;

	// Simulate processing delay (1 second for easier E2E testing)
	await new Promise((resolve) => setTimeout(resolve, 1000));

	// Simple validation
	if (!name || !email) {
		return {
			success: false,
			message: "Name and email are required",
		};
	}

	// Test-specific response for E2E
	if (email.includes("test-fetcher@example.com")) {
		return {
			success: true,
			message: "Fetcher test completed successfully!",
			updatedUser: {
				id: 1,
				name,
				email,
				lastUpdated: new Date().toISOString(),
			},
		};
	}

	const updatedUser: User = {
		id: 1,
		name,
		email,
		lastUpdated: new Date().toISOString(),
	};

	return {
		success: true,
		message: "User updated successfully!",
		updatedUser,
	};
}

export function meta() {
	return [
		{ title: "Submitter with Loader - Test Playground" },
		{
			name: "description",
			content: "Testing useDynamicSubmitter with useLoaderData integration",
		},
	];
}

export const route: RoutePath<"/router-toolkit/submitter-with-loader"> =
	"/router-toolkit/submitter-with-loader";

export const formSchema = z.object({
	name: z.string().min(1),
	email: z.email(),
});

export default function SubmitterWithLoader() {
	const loaderData = useLoaderData<LoaderData>();
	const submitter = useDynamicSubmitter<
		typeof import("./submitter-with-loader")
	>("/router-toolkit/submitter-with-loader");
	const nameId = useId();
	const emailId = useId();
	return (
		<div>
			<Link to="/">← Back to Home</Link>
			<h1>Submitter with Loader Test</h1>
			<p>Testing useDynamicSubmitter working alongside useLoaderData</p>

			<div>
				<div>
					<h2>Current User Data</h2>
					<div>
						<h3>Loaded from Server:</h3>
						<pre>{JSON.stringify(loaderData.user, null, 2)}</pre>
					</div>
				</div>

				<div>
					<h2>Update User</h2>
					<submitter.Form method="post">
						<div>
							<label htmlFor={nameId}>Name:</label>
							<input
								id={nameId}
								name="name"
								type="text"
								defaultValue={loaderData.user.name}
								required
							/>
						</div>

						<div>
							<label htmlFor={emailId}>Email:</label>
							<input
								id={emailId}
								name="email"
								type="email"
								defaultValue={loaderData.user.email}
								required
							/>
						</div>

						<button
							type="submit"
							disabled={submitter.state === "submitting"}
							data-testid="submitter-submit-button"
						>
							{submitter.state === "submitting" ? "Updating..." : "Update User"}
						</button>
					</submitter.Form>
				</div>
			</div>

			<div>
				<h2>Submitter Status:</h2>
				<pre data-testid="submitter-status">
					{JSON.stringify({ state: submitter.state }, null, 2)}
				</pre>
			</div>

			{submitter.data && (
				<div data-testid="action-result">
					<h2>Action Result:</h2>
					<pre>{JSON.stringify(submitter.data, null, 2)}</pre>

					{submitter.data.success ? (
						<div>
							<p>✅ {submitter.data.message}</p>
							{submitter.data.updatedUser && (
								<p>
									Updated: {submitter.data.updatedUser.name} (
									{submitter.data.updatedUser.email})
								</p>
							)}
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
