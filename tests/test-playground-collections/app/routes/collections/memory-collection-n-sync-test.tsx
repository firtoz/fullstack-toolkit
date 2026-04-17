import { ClientOnly } from "~/components/shared/ClientOnly";
import { MemoryCollectionNSyncTestPage } from "~/components/collections/memory-collection-test/MemoryCollectionNSyncTestPage";

export default function MemoryCollectionNSyncTestRoute() {
	return (
		<ClientOnly>
			<MemoryCollectionNSyncTestPage />
		</ClientOnly>
	);
}
