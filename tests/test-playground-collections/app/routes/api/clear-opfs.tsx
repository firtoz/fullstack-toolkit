import type { RoutePath } from "@firtoz/router-toolkit";
import { useEffect, useRef, useState } from "react";
import ClearOpfsWorker from "~/workers/clear-opfs.worker?worker";
import { ClearOpfsWorkerClient } from "~/utils/clear-opfs.client";
import type { OpfsEntry } from "~/workers/clear-opfs.schema";

export default function ClearOpfs() {
	const [status, setStatus] = useState<{
		type: "idle" | "loading" | "success" | "error";
		message?: string;
	}>({ type: "idle" });
	const [entries, setEntries] = useState<OpfsEntry[]>([]);
	const [isListing, setIsListing] = useState(false);
	const clientRef = useRef<ClearOpfsWorkerClient | null>(null);
	const [workerReady, setWorkerReady] = useState(false);

	useEffect(() => {
		// Create worker and client
		const worker = new ClearOpfsWorker();
		const client = new ClearOpfsWorkerClient(worker);
		clientRef.current = client;

		// Set up callbacks
		client.onReady(() => {
			setWorkerReady(true);
			// Automatically list on ready
			client.list();
			setIsListing(true);
		});

		client.onCleared((count) => {
			setStatus({
				type: "success",
				message: `Successfully cleared ${count} OPFS entries`,
			});
			// Refresh the list after clearing
			client.list();
			setIsListing(true);
		});

		client.onListed((newEntries) => {
			setEntries(newEntries);
			setIsListing(false);
		});

		client.onError((error) => {
			setStatus({
				type: "error",
				message: `Error: ${error}`,
			});
			setIsListing(false);
		});

		// Cleanup on unmount
		return () => {
			client.terminate();
		};
	}, []);

	const clearOPFS = () => {
		if (!clientRef.current || !workerReady) {
			setStatus({
				type: "error",
				message: "Worker not ready",
			});
			return;
		}

		setStatus({ type: "loading" });
		clientRef.current.clear();
	};

	const refreshList = () => {
		if (!clientRef.current || !workerReady) {
			return;
		}
		setIsListing(true);
		clientRef.current.list();
	};

	const renderEntry = (entry: OpfsEntry, depth = 0) => {
		const indent = depth * 24;
		const isDirectory = entry.kind === "directory";

		return (
			<div key={entry.path}>
				<div style={{ paddingLeft: `${indent + 8}px` }}>
					<span>{isDirectory ? "📁" : "📄"}</span>
					<span>{entry.name}</span>
					<span>{entry.path}</span>
				</div>
				{isDirectory && entry.children && entry.children.length > 0 && (
					<div>
						{entry.children.map((child) => renderEntry(child, depth + 1))}
					</div>
				)}
			</div>
		);
	};

	return (
		<div>
			{/* Clear OPFS Section */}
			<div>
				<h1>Clear OPFS Storage</h1>
				<p>
					This will clear all OPFS (Origin Private File System) storage for this
					origin.
				</p>
				<p>⚠️ Warning: This action cannot be undone!</p>

				<button
					type="button"
					onClick={clearOPFS}
					disabled={status.type === "loading" || !workerReady}
				>
					{!workerReady
						? "Initializing worker..."
						: status.type === "loading"
							? "Clearing..."
							: "Clear All OPFS Data"}
				</button>

				{status.type === "success" && (
					<div>
						<p>✓ {status.message}</p>
					</div>
				)}

				{status.type === "error" && (
					<div>
						<p>✗ {status.message}</p>
					</div>
				)}
			</div>

			{/* OPFS Directory Listing Section */}
			<div>
				<div>
					<h2>OPFS Directory Structure</h2>
					<button
						type="button"
						onClick={refreshList}
						disabled={isListing || !workerReady}
					>
						<span>{isListing ? "Refreshing..." : "🔄 Refresh"}</span>
					</button>
				</div>

				{isListing && <div>Loading directory structure...</div>}

				{!isListing && entries.length === 0 && <div>OPFS is empty</div>}

				{!isListing && entries.length > 0 && (
					<div>{entries.map((entry) => renderEntry(entry))}</div>
				)}

				{entries.length > 0 && <div>Total entries: {entries.length}</div>}
			</div>
		</div>
	);
}

export const route: RoutePath<"/api/clear-opfs"> = "/api/clear-opfs";
