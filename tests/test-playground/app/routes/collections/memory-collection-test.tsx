import { ClientOnly } from "~/components/shared/ClientOnly";
import { MemoryCollectionTestPage } from "~/components/collections/memory-collection-test/MemoryCollectionTestPage";

export default function MemoryCollectionTestRoute() {
	return (
		<ClientOnly>
			<MemoryCollectionTestPage />
		</ClientOnly>
	);
}
