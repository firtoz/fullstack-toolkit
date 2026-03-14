import { ClientOnly } from "~/components/shared/ClientOnly";
import { KeyValCollectionTestPage } from "~/components/collections/keyval-collection-test/KeyValCollectionTestPage";

export default function KeyValCollectionTestRoute() {
	return (
		<ClientOnly>
			<KeyValCollectionTestPage />
		</ClientOnly>
	);
}
