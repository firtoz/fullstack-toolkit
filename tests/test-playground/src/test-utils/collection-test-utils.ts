/**
 * Test utilities for collection testing
 * Provides mocking and verification utilities for IndexedDB and SQLite operations
 */

import { makeId } from "@firtoz/drizzle-utils";
import { todoTable, userTable } from "test-schema/schema";
import type { Todo } from "test-schema/schema";

/**
 * Create mock IndexedDB that tracks operations
 */
export function createMockIndexedDB() {
	const operationLog: Array<{
		type: "getAll" | "getAllFromIndex" | "add" | "put" | "delete" | "get";
		storeName?: string;
		indexName?: string;
		keyRange?: IDBKeyRange;
		key?: string;
		timestamp: number;
	}> = [];

	const mockData: Record<string, Todo> = {};

	const createMockRequest = (result: unknown) => {
		const request = {
			result,
			onsuccess: null as ((event: unknown) => void) | null,
			onerror: null as ((event: unknown) => void) | null,
		};
		// Call onsuccess async to simulate real IndexedDB
		queueMicrotask(() => {
			if (request.onsuccess) {
				request.onsuccess({ target: request });
			}
		});
		return request;
	};

	const createMockStore = (storeName: string, _mode: IDBTransactionMode) => {
		return {
			get: (key: string) => {
				operationLog.push({
					type: "get",
					storeName,
					key,
					timestamp: Date.now(),
				});
				return createMockRequest(mockData[key]);
			},
			getAll: () => {
				operationLog.push({
					type: "getAll",
					storeName,
					timestamp: Date.now(),
				});
				return createMockRequest(Object.values(mockData));
			},
			add: (item: Todo) => {
				operationLog.push({
					type: "add",
					storeName,
					timestamp: Date.now(),
				});
				mockData[item.id] = item;
				return createMockRequest(item.id);
			},
			put: (item: Todo) => {
				operationLog.push({
					type: "put",
					storeName,
					key: item.id,
					timestamp: Date.now(),
				});
				mockData[item.id] = item;
				return createMockRequest(item.id);
			},
			delete: (key: string) => {
				operationLog.push({
					type: "delete",
					storeName,
					key,
					timestamp: Date.now(),
				});
				delete mockData[key];
				return createMockRequest(undefined);
			},
			index: (indexName: string) => ({
				getAll: (keyRange?: IDBKeyRange) => {
					operationLog.push({
						type: "getAllFromIndex",
						storeName,
						indexName,
						keyRange,
						timestamp: Date.now(),
					});
					// Filter mockData based on keyRange
					const result = Object.values(mockData);
					return createMockRequest(result);
				},
				keyPath: indexName.replace("todo_", "").replace("_index", ""),
			}),
			indexNames: ["todo_priority_index", "todo_status_index"],
		} as unknown as IDBObjectStore;
	};

	const mockDB = {
		objectStoreNames: {
			contains: (name: string) => name === "todo",
		},
		transaction: (_storeName: string | string[], mode: IDBTransactionMode) => {
			const transaction = {
				objectStore: (name: string) => createMockStore(name, mode),
				oncomplete: null as ((event: unknown) => void) | null,
				onerror: null as ((event: unknown) => void) | null,
				onabort: null as ((event: unknown) => void) | null,
			};
			// Call oncomplete async
			queueMicrotask(() => {
				if (transaction.oncomplete) {
					transaction.oncomplete({ target: transaction });
				}
			});
			return transaction;
		},
	} as unknown as IDBDatabase;

	return {
		db: mockDB,
		operationLog,
		mockData,
		clearLog: () => {
			operationLog.length = 0;
		},
		addMockData: (items: Todo[]) => {
			for (const item of items) {
				mockData[item.id] = item;
			}
		},
		getOperationsByType: (type: string) =>
			operationLog.filter((op) => op.type === type),
		hasIndexedQuery: (indexName: string) =>
			operationLog.some(
				(op) => op.type === "getAllFromIndex" && op.indexName === indexName,
			),
		hasFullScan: () => operationLog.some((op) => op.type === "getAll"),
	};
}

/**
 * Create test todo items with various field values for testing
 */
export function createTestTodos(): Todo[] {
	const now = new Date();
	return [
		{
			id: makeId(todoTable, "1"),
			title: "Low priority task",
			content: "This is a simple task",
			priority: 1,
			status: "pending",
			tags: "work,urgent",
			completed: false,
			parentId: null,
			userId: makeId(userTable, "user1"),
			createdAt: now,
			updatedAt: now,
			deletedAt: null,
		},
		{
			id: makeId(todoTable, "2"),
			title: "Medium priority task",
			content: "Another task with sup in it",
			priority: 5,
			status: "in-progress",
			tags: "personal",
			completed: false,
			parentId: null,
			userId: makeId(userTable, "user1"),
			createdAt: now,
			updatedAt: now,
			deletedAt: null,
		},
		{
			id: makeId(todoTable, "3"),
			title: "High priority task",
			content: "Critical task",
			priority: 10,
			status: "pending",
			tags: "work,critical",
			completed: false,
			parentId: null,
			userId: makeId(userTable, "user2"),
			createdAt: now,
			updatedAt: now,
			deletedAt: null,
		},
		{
			id: makeId(todoTable, "4"),
			title: "Very high priority",
			content: "Super urgent task",
			priority: 15,
			status: "done",
			tags: "urgent",
			completed: true,
			parentId: null,
			userId: makeId(userTable, "user1"),
			createdAt: now,
			updatedAt: now,
			deletedAt: null,
		},
		{
			id: makeId(todoTable, "5"),
			title: "Ultra priority",
			content: "Supremely important",
			priority: 20,
			status: "pending",
			tags: "work",
			completed: false,
			parentId: null,
			userId: makeId(userTable, "user2"),
			createdAt: now,
			updatedAt: now,
			deletedAt: null,
		},
		{
			id: makeId(todoTable, "6"),
			title: "Medium task",
			content: "Regular content",
			priority: 7,
			status: "in-progress",
			tags: "personal,fun",
			completed: false,
			parentId: null,
			userId: makeId(userTable, "user1"),
			createdAt: now,
			updatedAt: now,
			deletedAt: null,
		},
		{
			id: makeId(todoTable, "7"),
			title: "Low task",
			content: "Low importance",
			priority: 3,
			status: "pending",
			tags: null,
			completed: false,
			parentId: null,
			userId: null,
			createdAt: now,
			updatedAt: now,
			deletedAt: null,
		},
	];
}

/**
 * Query operation tracker for testing duplicate handling
 */
export class QueryTracker {
	private queries: Array<{
		expression: string;
		timestamp: number;
		itemsWritten: string[];
	}> = [];

	recordQuery(expression: string, itemIds: string[]) {
		this.queries.push({
			expression,
			timestamp: Date.now(),
			itemsWritten: itemIds,
		});
	}

	getOverlappingItems(): string[] {
		if (this.queries.length < 2) return [];

		const allItems = new Set<string>();
		const overlapping = new Set<string>();

		for (const query of this.queries) {
			for (const id of query.itemsWritten) {
				if (allItems.has(id)) {
					overlapping.add(id);
				}
				allItems.add(id);
			}
		}

		return Array.from(overlapping);
	}

	hasQueryForExpression(expression: string): boolean {
		return this.queries.some((q) => q.expression === expression);
	}

	getQueryCount(): number {
		return this.queries.length;
	}

	clear() {
		this.queries.length = 0;
	}
}
