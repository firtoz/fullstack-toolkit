/**
 * IndexedDB mocks for Node.js test environment
 * Provides minimal IDBKeyRange implementation for unit tests
 */

// Mock IDBKeyRange for tests running in Node.js
export class MockIDBKeyRange {
	lower?: IDBValidKey;
	upper?: IDBValidKey;
	lowerOpen: boolean;
	upperOpen: boolean;

	constructor(
		lower: IDBValidKey | undefined,
		upper: IDBValidKey | undefined,
		lowerOpen: boolean = false,
		upperOpen: boolean = false,
	) {
		this.lower = lower;
		this.upper = upper;
		this.lowerOpen = lowerOpen;
		this.upperOpen = upperOpen;
	}

	static only(value: IDBValidKey): MockIDBKeyRange {
		return new MockIDBKeyRange(value, value, false, false);
	}

	static lowerBound(
		lower: IDBValidKey,
		open: boolean = false,
	): MockIDBKeyRange {
		return new MockIDBKeyRange(lower, undefined, open, false);
	}

	static upperBound(
		upper: IDBValidKey,
		open: boolean = false,
	): MockIDBKeyRange {
		return new MockIDBKeyRange(undefined, upper, false, open);
	}

	static bound(
		lower: IDBValidKey,
		upper: IDBValidKey,
		lowerOpen: boolean = false,
		upperOpen: boolean = false,
	): MockIDBKeyRange {
		return new MockIDBKeyRange(lower, upper, lowerOpen, upperOpen);
	}
}

/**
 * Setup IDBKeyRange mock in global scope for tests
 */
export function setupIndexedDBMocks() {
	// @ts-expect-error - Setting global for tests
	globalThis.IDBKeyRange = MockIDBKeyRange;
}
