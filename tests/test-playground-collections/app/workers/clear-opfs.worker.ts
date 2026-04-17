// Worker for clearing OPFS storage
// This is needed because OPFS synchronous access (used by SQLite) is only available in workers

import { WorkerHelper } from "@firtoz/worker-helper";
import { exhaustiveGuard } from "@firtoz/maybe-error";
import {
	ClearOpfsClientMessageSchema,
	ClearOpfsServerMessageSchema,
	ClearOpfsClientMessageType,
	ClearOpfsServerMessageType,
	type ClearOpfsClientMessage,
	type ClearOpfsServerMessage,
	type OpfsEntry,
} from "./clear-opfs.schema";

declare global {
	interface FileSystemDirectoryHandle {
		entries: () => IterableIterator<[string, FileSystemHandle]>;
		values: () => IterableIterator<FileSystemHandle>;
	}
}

const isDirectory = (
	handle: FileSystemHandle,
): handle is FileSystemDirectoryHandle => {
	return handle.kind === "directory";
};

class ClearOpfsWorkerHelper extends WorkerHelper<
	ClearOpfsClientMessage,
	ClearOpfsServerMessage
> {
	constructor() {
		super(
			self as unknown as DedicatedWorkerGlobalScope,
			ClearOpfsClientMessageSchema,
			ClearOpfsServerMessageSchema,
			{
				handleMessage: (data) => {
					this._handleMessage(data);
				},
				handleInputValidationError: (error, originalData) => {
					console.error("Input validation error", { error, originalData });
				},
				handleOutputValidationError: (error, originalData) => {
					console.error("Output validation error", { error, originalData });
				},
				handleProcessingError: (error, validatedData) => {
					console.error("Processing error", { error, validatedData });
				},
			},
		);

		// Send ready message
		this.send({
			type: ClearOpfsServerMessageType.Ready,
		});
	}

	private async listOPFS() {
		try {
			const root = await navigator.storage.getDirectory();
			const entries = await this.listDirectoryRecursive(root, "/");

			this.send({
				type: ClearOpfsServerMessageType.Listed,
				entries,
			});
		} catch (error) {
			this.send({
				type: ClearOpfsServerMessageType.Error,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	private async listDirectoryRecursive(
		directory: FileSystemDirectoryHandle,
		path: string,
	): Promise<OpfsEntry[]> {
		const entries: OpfsEntry[] = [];

		for await (const [name, handle] of directory.entries()) {
			const entryPath = path === "/" ? `/${name}` : `${path}/${name}`;

			if (isDirectory(handle)) {
				const children = await this.listDirectoryRecursive(handle, entryPath);
				entries.push({
					name,
					kind: "directory",
					path: entryPath,
					children,
				});
			} else {
				entries.push({
					name,
					kind: "file",
					path: entryPath,
				});
			}
		}

		return entries;
	}

	private async clearOPFS() {
		try {
			const root = await navigator.storage.getDirectory();
			let count = 0;

			for await (const entry of root.values()) {
				try {
					await root.removeEntry(entry.name, { recursive: true });
					count++;
					console.log(`Cleared OPFS entry: ${entry.name}`);
				} catch (e) {
					console.error(`Failed to remove ${entry.name}:`, e);
				}
			}

			this.send({
				type: ClearOpfsServerMessageType.Cleared,
				count,
			});
		} catch (error) {
			this.send({
				type: ClearOpfsServerMessageType.Error,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	private async _handleMessage(data: ClearOpfsClientMessage) {
		const { type } = data;
		switch (type) {
			case ClearOpfsClientMessageType.Clear:
				await this.clearOPFS();
				break;
			case ClearOpfsClientMessageType.List:
				await this.listOPFS();
				break;
			default:
				throw exhaustiveGuard(type);
		}
	}
}

new ClearOpfsWorkerHelper();
