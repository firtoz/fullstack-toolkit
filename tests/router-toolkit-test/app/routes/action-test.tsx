import { type RoutePath, useDynamicSubmitter } from "@firtoz/router-toolkit";
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
		{ title: "Action Test - Router Toolkit" },
		{ name: "description", content: "Testing useDynamicSubmitter hook" },
	];
}

export const route: RoutePath<"/action-test"> = "/action-test";

export const formSchema = z.object({
	name: z.string().min(1),
	email: z.email(),
});

export default function ActionTest() {
	// useDynamicSubmitter would be used here with proper route registration and form schema
	const submitter =
		useDynamicSubmitter<typeof import("./action-test")>("/action-test");

	return (
		<div className="p-6">
			<h1 className="text-2xl font-bold mb-4">Action Test</h1>
			<p className="mb-4">Testing React Router form actions</p>

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

				<button
					type="submit"
					disabled={submitter.state === "submitting"}
					className="bg-green-500 text-white px-4 py-2 rounded disabled:opacity-50"
				>
					{submitter.state === "submitting" ? "Submitting..." : "Submit"}
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
							<p className="text-green-800">✅ {submitter.data.message}</p>
						</div>
					) : (
						<div className="mt-4 p-3 bg-red-100 rounded">
							<p className="text-red-800">❌ {submitter.data.message}</p>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
