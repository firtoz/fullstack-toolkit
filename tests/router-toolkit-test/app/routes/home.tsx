import { Link } from "react-router";
import { Welcome } from "../welcome/welcome";

export function meta() {
	return [
		{ title: "Router Toolkit Test App" },
		{
			name: "description",
			content: "Test application for @firtoz/router-toolkit",
		},
	];
}

export default function Home() {
	return (
		<div className="min-h-screen bg-gray-50">
			<div className="max-w-4xl mx-auto py-8 px-4">
				<div className="text-center mb-8">
					<h1 className="text-3xl font-bold text-gray-900 mb-2">
						Router Toolkit Test App
					</h1>
					<p className="text-gray-600">
						Testing @firtoz/router-toolkit hooks in React Router v7 Framework
						Mode
					</p>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
					{/* Loader Test Card */}
					<div className="bg-white rounded-lg shadow-md p-6">
						<h2 className="text-xl font-semibold text-blue-600 mb-3">
							Loader Test
						</h2>
						<p className="text-gray-600 mb-4">
							Test route with data loading functionality using React Router's
							useFetcher hook.
						</p>
						<Link
							to="/loader-test"
							className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
						>
							Test Loader →
						</Link>
					</div>

					{/* Action Test Card */}
					<div className="bg-white rounded-lg shadow-md p-6">
						<h2 className="text-xl font-semibold text-green-600 mb-3">
							Action Test
						</h2>
						<p className="text-gray-600 mb-4">
							Test route with form submission and action handling capabilities.
						</p>
						<Link
							to="/action-test"
							className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition-colors"
						>
							Test Action →
						</Link>
					</div>

					{/* Form Action Test Card */}
					<div className="bg-white rounded-lg shadow-md p-6">
						<h2 className="text-xl font-semibold text-orange-600 mb-3">
							Form Action Test
						</h2>
						<p className="text-gray-600 mb-4">
							Test formAction utility with Zod validation and type-safe error
							handling.
						</p>
						<Link
							to="/form-action-test"
							className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600 transition-colors"
						>
							Test formAction →
						</Link>
					</div>

					{/* Combined Test Card */}
					<div className="bg-white rounded-lg shadow-md p-6">
						<h2 className="text-xl font-semibold text-purple-600 mb-3">
							Combined Test
						</h2>
						<p className="text-gray-600 mb-4">
							Test route with both data loading and form submission
							capabilities.
						</p>
						<Link
							to="/combined-test"
							className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 transition-colors"
						>
							Test Both →
						</Link>
					</div>
				</div>

				{/* Welcome Section */}
				<div className="bg-white rounded-lg shadow-md p-6">
					<Welcome />
				</div>
			</div>
		</div>
	);
}
