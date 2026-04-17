import type { RoutePath } from "@firtoz/router-toolkit";
import { useSearchParams } from "react-router";
import {
	DrizzleIndexedDBProvider,
	useDrizzleIndexedDB,
} from "@firtoz/drizzle-indexeddb";
import * as schema from "test-schema/schema";
import { migrations } from "test-schema/drizzle/indexeddb-migrations";
import { todoLoader } from "~/utils/todo-loaders";
import { ClientOnly } from "~/components/shared/ClientOnly";
import { TodoListContainer } from "~/components/shared/TodoListContainer";

export const loader = todoLoader;

const TodoList = () => {
	const { useCollection } = useDrizzleIndexedDB<typeof schema>();

	const todoCollection = useCollection("todoTable");

	return (
		<TodoListContainer
			collection={todoCollection}
			title="Tasks"
			description="IndexedDB with Drizzle collections"
		/>
	);
};

function indexeddbPlaygroundDbNameFromSearchParams(
	searchParams: URLSearchParams,
): string {
	const w = searchParams.get("e2eWorker");
	return w !== null && /^\d+$/.test(w)
		? `test-indexeddb-w${w}.db`
		: "test-indexeddb.db";
}

export default function IndexedDBTest() {
	const [searchParams] = useSearchParams();
	const dbName = indexeddbPlaygroundDbNameFromSearchParams(searchParams);

	return (
		<ClientOnly>
			<DrizzleIndexedDBProvider
				dbName={dbName}
				schema={schema}
				migrations={migrations}
				syncMode="on-demand"
			>
				<TodoList />
			</DrizzleIndexedDBProvider>
		</ClientOnly>
	);
}

export const route: RoutePath<"/collections/indexeddb-test"> =
	"/collections/indexeddb-test";
