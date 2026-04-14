/**
 * Call names that cannot be used in {@link defineSocka} `calls` because they would
 * make {@link SockaSession} `send` look Promise-like or clash with ordinary object
 * shape (`constructor`, `Object.prototype`). Call names live only under `send`, so
 * session fields like `client` / `close` need not be reserved.
 */
export const RESERVED_SOCKA_PROCEDURE_NAMES = [
	// Promise-like (thenables)
	"then",
	"catch",
	"finally",
	// Instance shape
	"constructor",
	// Typical Object.prototype / debugging
	"toString",
	"valueOf",
	"toLocaleString",
	"hasOwnProperty",
	"isPrototypeOf",
	"propertyIsEnumerable",
] as const;

/** Union of {@link RESERVED_SOCKA_PROCEDURE_NAMES}. */
export type ReservedSockaProcedureName =
	(typeof RESERVED_SOCKA_PROCEDURE_NAMES)[number];
