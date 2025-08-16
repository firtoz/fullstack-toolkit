import { fail, success } from "@firtoz/maybe-error";
import {
	formAction,
	type RoutePath,
	useDynamicSubmitter,
} from "@firtoz/router-toolkit";
import { z } from "zod/v4";

export const formSchema = z.object({
	name: z.string().min(2, "Name must be at least 2 characters"),
	email: z.string().email("Invalid email format"),
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
				id: Math.random().toString(36).substr(2, 9),
				name: data.name,
				email: data.email,
				age: data.age,
			},
		});
	},
});

export const route: RoutePath<"/form-action-test"> = "/form-action-test";

export function meta() {
	return [
		{ title: "Form Action Test - Router Toolkit" },
		{
			name: "description",
			content: "Testing formAction utility with type-safe form handling",
		},
	];
}

export default function FormActionTest() {
	const submitter =
		useDynamicSubmitter<typeof import("./form-action-test")>(
			"/form-action-test",
		);

	return (
		<div className="p-6">
			<h1 className="text-2xl font-bold mb-4">Form Action Test</h1>
			<p className="mb-4">
				Testing the formAction utility with Zod validation and type-safe error
				handling
			</p>

			<submitter.Form method="post" className="space-y-4 max-w-md">
				<div>
					<label htmlFor="name" className="block text-sm font-medium mb-1">
						Name:
					</label>
					<input
						id="name"
						name="name"
						type="text"
						required
						className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</div>

				<div>
					<label htmlFor="email" className="block text-sm font-medium mb-1">
						Email:
					</label>
					<input
						id="email"
						name="email"
						type="email"
						required
						className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</div>

				<div>
					<label htmlFor="age" className="block text-sm font-medium mb-1">
						Age:
					</label>
					<input
						id="age"
						name="age"
						type="number"
						required
						min="18"
						className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</div>

				<div className="flex items-center">
					<input
						id="terms"
						name="terms"
						type="checkbox"
						required
						className="mr-2"
					/>
					<label htmlFor="terms" className="text-sm">
						I accept the terms and conditions
					</label>
				</div>

				<button
					type="submit"
					disabled={submitter.state === "submitting"}
					className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50 hover:bg-blue-600"
				>
					{submitter.state === "submitting" ? "Registering..." : "Register"}
				</button>
			</submitter.Form>

			<div className="mt-6">
				<h2 className="text-lg font-semibold mb-2">Fetcher State:</h2>
				<pre className="bg-gray-200 p-3 rounded text-sm text-gray-800">
					{JSON.stringify({ state: submitter.state }, null, 2)}
				</pre>
			</div>

			{submitter.data && (
				<div className="mt-6">
					<h2 className="text-lg font-semibold mb-2">Action Result:</h2>
					<pre className="bg-gray-200 p-3 rounded text-sm text-gray-800">
						{JSON.stringify(submitter.data, null, 2)}
					</pre>

					{submitter.data.success ? (
						<div className="mt-4 p-3 bg-green-100 rounded">
							<p className="text-green-800">✅ Registration successful!</p>
							{submitter.data.result && (
								<div className="mt-2">
									<p className="text-sm text-green-700">
										Welcome, {submitter.data.result.user.name}! User ID:{" "}
										{submitter.data.result.user.id}
									</p>
								</div>
							)}
						</div>
					) : (
						<div className="mt-4 p-3 bg-red-100 rounded">
							<p className="text-red-800">❌ Registration failed</p>
							{submitter.data.error.type === "validation" && (
								<div className="mt-2">
									<p className="text-sm text-red-700">Validation errors:</p>
									<pre className="text-xs text-red-600 mt-1">
										{JSON.stringify(submitter.data.error.error, null, 2)}
									</pre>
								</div>
							)}
							{submitter.data.error.type === "handler" && (
								<div className="mt-2">
									<p className="text-sm text-red-700">
										Error: {submitter.data.error.error}
									</p>
								</div>
							)}
							{submitter.data.error.type === "unknown" && (
								<div className="mt-2">
									<p className="text-sm text-red-700">
										An unexpected error occurred. Please try again.
									</p>
								</div>
							)}
						</div>
					)}
				</div>
			)}

			<div className="mt-8 p-4 bg-blue-50 rounded">
				<h3 className="text-lg font-semibold mb-2">Test Cases:</h3>
				<ul className="text-sm space-y-1">
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
