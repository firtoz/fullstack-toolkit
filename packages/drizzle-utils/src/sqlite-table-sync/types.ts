/**
 * Operation tracking for SQLite-backed TanStack sync backends.
 * Uses discriminated unions so TypeScript can narrow on `type`.
 */
export type SQLOperation =
	| {
			type: "select-all";
			tableName: string;
			itemsReturned: unknown[];
			itemCount: number;
			context: string;
			sql?: string;
			timestamp: number;
	  }
	| {
			type: "select-where";
			tableName: string;
			whereClause: string;
			itemsReturned: unknown[];
			itemCount: number;
			context: string;
			sql?: string;
			timestamp: number;
	  }
	| {
			type: "write";
			tableName: string;
			itemsWritten: unknown[];
			writeCount: number;
			context: string;
			timestamp: number;
	  }
	| {
			type: "insert";
			tableName: string;
			item: unknown;
			sql?: string;
			timestamp: number;
	  }
	| {
			type: "update";
			tableName: string;
			updates: unknown;
			sql?: string;
			timestamp: number;
	  }
	| {
			type: "delete";
			tableName: string;
			sql?: string;
			timestamp: number;
	  }
	| {
			type: "raw-query";
			sql: string;
			params?: unknown[];
			method: string;
			rowCount: number;
			context: string;
			timestamp: number;
	  };

export interface SQLInterceptor {
	onOperation?: (operation: SQLOperation) => void;
}
