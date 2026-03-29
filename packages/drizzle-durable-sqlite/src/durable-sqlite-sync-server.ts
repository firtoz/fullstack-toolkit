import type { SyncMessage } from "@firtoz/db-helpers";
import { exhaustiveGuard } from "@firtoz/maybe-error";

type MutationIntent<TItem> =
	| {
			clientMutationId: string;
			type: "insert";
			value: TItem;
	  }
	| {
			clientMutationId: string;
			type: "update";
			key: string | number;
			value: TItem;
			previousValue: TItem;
	  }
	| {
			clientMutationId: string;
			type: "delete";
			key: string | number;
	  }
	| {
			clientMutationId: string;
			type: "truncate";
	  };

export interface DurableCollectionLike<TItem> {
	insert: (item: Partial<TItem>) => { isPersisted: { promise: Promise<void> } };
	update: (
		key: string | number,
		updater: (draft: TItem) => void,
	) => { isPersisted: { promise: Promise<void> } };
	delete: (key: string | number) => { isPersisted: { promise: Promise<void> } };
	utils: {
		truncate: () => Promise<void>;
	};
}

export async function applyDurableMutationIntents<
	TItem extends { id: string | number },
>(
	collection: DurableCollectionLike<TItem>,
	intents: MutationIntent<TItem>[],
): Promise<{
	changes: SyncMessage<TItem>[];
	acceptedMutationIds: string[];
}> {
	const changes: SyncMessage<TItem>[] = [];
	const acceptedMutationIds: string[] = [];

	for (const intent of intents) {
		switch (intent.type) {
			case "insert": {
				const tx = collection.insert(intent.value);
				await tx.isPersisted.promise;
				changes.push({ type: "insert", value: intent.value });
				acceptedMutationIds.push(intent.clientMutationId);
				break;
			}
			case "update": {
				const tx = collection.update(intent.key, (draft) => {
					Object.assign(draft, intent.value);
				});
				await tx.isPersisted.promise;
				changes.push({
					type: "update",
					value: intent.value,
					previousValue: intent.previousValue,
				});
				acceptedMutationIds.push(intent.clientMutationId);
				break;
			}
			case "delete": {
				const tx = collection.delete(intent.key);
				await tx.isPersisted.promise;
				changes.push({ type: "delete", key: intent.key });
				acceptedMutationIds.push(intent.clientMutationId);
				break;
			}
			case "truncate":
				await collection.utils.truncate();
				changes.push({ type: "truncate" });
				acceptedMutationIds.push(intent.clientMutationId);
				break;
			default:
				exhaustiveGuard(intent);
		}
	}

	return { changes, acceptedMutationIds };
}
