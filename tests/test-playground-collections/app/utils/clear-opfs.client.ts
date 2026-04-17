import { WorkerClient } from "@firtoz/worker-helper/WorkerClient";
import { exhaustiveGuard } from "@firtoz/maybe-error";
import {
	ClearOpfsClientMessageSchema,
	ClearOpfsServerMessageSchema,
	ClearOpfsClientMessageType,
	ClearOpfsServerMessageType,
	type ClearOpfsClientMessage,
	type ClearOpfsServerMessage,
	type OpfsEntry,
} from "../workers/clear-opfs.schema";

export class ClearOpfsWorkerClient extends WorkerClient<
	ClearOpfsClientMessage,
	ClearOpfsServerMessage
> {
	private onReadyCallback?: () => void;
	private onClearedCallback?: (count: number) => void;
	private onListedCallback?: (entries: OpfsEntry[]) => void;
	private onErrorCallback?: (error: string) => void;

	constructor(worker: Worker) {
		super({
			worker,
			clientSchema: ClearOpfsClientMessageSchema,
			serverSchema: ClearOpfsServerMessageSchema,
			onMessage: (message) => {
				this.onMessage(message);
			},
			onValidationError: (error, rawMessage) => {
				console.error("Validation error", { error, rawMessage });
			},
			onError: (event) => {
				console.error("Worker error", event);
			},
		});
	}

	private onMessage(message: ClearOpfsServerMessage) {
		const { type } = message;
		switch (type) {
			case ClearOpfsServerMessageType.Ready:
				this.onReadyCallback?.();
				break;
			case ClearOpfsServerMessageType.Cleared:
				this.onClearedCallback?.(message.count);
				break;
			case ClearOpfsServerMessageType.Listed:
				this.onListedCallback?.(message.entries);
				break;
			case ClearOpfsServerMessageType.Error:
				this.onErrorCallback?.(message.error);
				break;
			default:
				throw exhaustiveGuard(type);
		}
	}

	public onReady(callback: () => void) {
		this.onReadyCallback = callback;
	}

	public onCleared(callback: (count: number) => void) {
		this.onClearedCallback = callback;
	}

	public onListed(callback: (entries: OpfsEntry[]) => void) {
		this.onListedCallback = callback;
	}

	public onError(callback: (error: string) => void) {
		this.onErrorCallback = callback;
	}

	public clear() {
		this.send({
			type: ClearOpfsClientMessageType.Clear,
		});
	}

	public list() {
		this.send({
			type: ClearOpfsClientMessageType.List,
		});
	}
}
