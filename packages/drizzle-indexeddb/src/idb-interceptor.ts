/**
 * Operation tracking for IndexedDB queries
 * Useful for testing and debugging to verify what operations are actually performed
 *
 * Uses discriminated unions for type safety - TypeScript can narrow the type based on the 'type' field
 */
export type IDBOperation =
	| {
			type: "getAll";
			storeName: string;
			itemsReturned: unknown[];
			itemCount: number;
			context?: string;
			timestamp: number;
	  }
	| {
			type: "index-getAll";
			storeName: string;
			indexName: string;
			keyRange?: IDBKeyRange;
			itemsReturned: unknown[];
			itemCount: number;
			context?: string;
			timestamp: number;
	  }
	| {
			type: "write";
			storeName: string;
			itemsWritten: unknown[];
			writeCount: number;
			context?: string;
			timestamp: number;
	  }
	| {
			type: "get";
			storeName: string;
			key: IDBValidKey;
			itemReturned?: unknown;
			timestamp: number;
	  }
	| {
			type: "put";
			storeName: string;
			items: unknown[];
			itemCount: number;
			timestamp: number;
	  }
	| {
			type: "add";
			storeName: string;
			items: unknown[];
			itemCount: number;
			timestamp: number;
	  }
	| {
			type: "delete";
			storeName: string;
			keys: IDBValidKey[];
			keyCount: number;
			timestamp: number;
	  }
	| {
			type: "clear";
			storeName: string;
			timestamp: number;
	  };

/**
 * Interceptor interface for tracking IndexedDB operations
 * Allows tests and debugging tools to observe what operations are performed
 */
export interface IDBInterceptor {
	/** Called when any IndexedDB operation is performed */
	onOperation?: (operation: IDBOperation) => void;
}
