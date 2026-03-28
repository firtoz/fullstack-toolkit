import { createPartialSyncedCollection } from "@firtoz/collection-sync";
import { memoryCollectionOptions } from "@firtoz/db-helpers";
import { useMemo } from "react";
import { emojiGridRowSchema } from "./emoji-grid-row-schema";
import { EmojiGridPartialSyncClient } from "./EmojiGridPartialSyncClient";
import type { WsTransport } from "../home/types";

type Props = {
	roomId: string;
	wsTransport: WsTransport;
};

export function MemoryEmojiGridClient({ roomId, wsTransport }: Props) {
	const { collection, bridge, setTransportSend } = useMemo(
		() =>
			createPartialSyncedCollection(
				memoryCollectionOptions({
					id: `emoji-grid-memory-${roomId}`,
					schema: emojiGridRowSchema,
					getKey: (item) => item.id,
				}),
			),
		[roomId],
	);

	return (
		<EmojiGridPartialSyncClient
			collection={collection}
			mutationBridge={bridge}
			setTransportSend={setTransportSend}
			roomId={roomId}
			wsTransport={wsTransport}
			label="memory"
		/>
	);
}
