import { useConcurrentSubmitter } from "@firtoz/router-toolkit";
import { Link } from "react-router";

const FORM_ACTION_PATH = "/router-toolkit/form-action-test" as const;

export function meta() {
	return [
		{ title: "Concurrent Submitter - Test Playground" },
		{
			name: "description",
			content:
				"useConcurrentSubmitter with global provider (framework fetcher)",
		},
	];
}

export default function ConcurrentSubmitterTest() {
	const { operations, submitJson } =
		useConcurrentSubmitter<typeof import("./form-action-test")>();

	const handleSubmit = (label: string) => {
		const { id, promise } = submitJson(
			FORM_ACTION_PATH,
			{
				name: label,
				email: `${label.toLowerCase().replace(/\s/g, "")}@test.com`,
				age: 25,
				terms: "on",
			},
			{ method: "POST" },
		);
		promise
			.then((data) => {
				console.log(`Operation ${id} done:`, data);
			})
			.catch((err) => {
				console.error(`Operation ${id} error:`, err);
			});
	};

	return (
		<div>
			<Link to="/">← Back to Home</Link>
			<h1>Concurrent Submitter (Provider)</h1>
			<p>
				Submissions go through the framework fetcher (.data URL + turbo-stream).
				Fire multiple and watch the operations list.
			</p>

			<div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
				<button type="button" onClick={() => handleSubmit("Alice")}>
					Submit Alice
				</button>
				<button type="button" onClick={() => handleSubmit("Bob")}>
					Submit Bob
				</button>
				<button type="button" onClick={() => handleSubmit("Carol")}>
					Submit Carol
				</button>
			</div>

			<h2>Operations ({Object.keys(operations).length})</h2>
			<ul style={{ listStyle: "none", padding: 0 }}>
				{Object.values(operations).map((op) => (
					<li
						key={op.id}
						style={{
							padding: "0.5rem",
							marginBottom: "0.5rem",
							border: "1px solid #ccc",
							borderRadius: 4,
						}}
					>
						<strong>{op.id}</strong> — status: {op.status}
						{typeof op.submittedData === "object" &&
							op.submittedData !== null &&
							"name" in op.submittedData && (
								<> — {String((op.submittedData as { name: string }).name)}</>
							)}
						{op.status === "done" && op.data != null ? (
							<pre style={{ marginTop: "0.5rem", fontSize: 12 }}>
								{JSON.stringify(op.data, null, 2)}
							</pre>
						) : null}
						{op.status === "error" && op.error != null ? (
							<pre style={{ marginTop: "0.5rem", color: "red", fontSize: 12 }}>
								{String(op.error)}
							</pre>
						) : null}
					</li>
				))}
			</ul>
		</div>
	);
}
