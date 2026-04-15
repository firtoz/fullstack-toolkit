/**
 * Shared error reply shape for correlate-by-id RPC when the handler throws.
 * Narrow at the call site to your server message union if needed.
 */
export function toErrorReply(
	id: string,
	error: string,
): {
	type: "error";
	id: string;
	error: string;
} {
	return { type: "error", id, error };
}
