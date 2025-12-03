import type {
	IDBProxyRequest,
	IDBProxyResponse,
	IDBProxySyncMessage,
} from "./idb-proxy-types";

/**
 * Client-side transport interface.
 * Implement this to connect to an IDB proxy server via any messaging system.
 *
 * Examples of transports:
 * - Chrome extension: chrome.runtime.sendMessage
 * - WebSocket: ws.send + onmessage
 * - MessageChannel: port.postMessage
 * - In-memory (for testing): direct function call
 */
export interface IDBProxyClientTransport {
	/**
	 * Send a request to the server and wait for a response.
	 * The transport is responsible for correlating request/response by ID.
	 */
	sendRequest(request: IDBProxyRequest): Promise<IDBProxyResponse>;

	/**
	 * Register a handler for sync messages from the server.
	 * These are broadcasts when other clients modify data.
	 */
	onSync(handler: (message: IDBProxySyncMessage) => void): void;

	/**
	 * Optional: Clean up resources when the client is done.
	 */
	dispose?(): void;
}

/**
 * Server-side transport interface.
 * Implement this to receive requests from IDB proxy clients.
 */
export interface IDBProxyServerTransport {
	/**
	 * Register a handler for incoming requests.
	 * The handler should process the request and return a response.
	 * The transport is responsible for sending the response back to the client.
	 */
	onRequest(
		handler: (request: IDBProxyRequest) => Promise<IDBProxyResponse>,
	): void;

	/**
	 * Broadcast a sync message to all clients except the one specified.
	 * @param message The sync message to broadcast
	 * @param excludeClientId Client ID to exclude from the broadcast (the initiator)
	 */
	broadcast(message: IDBProxySyncMessage, excludeClientId: string): void;

	/**
	 * Optional: Clean up resources when the server is done.
	 */
	dispose?(): void;
}

/**
 * A simple in-memory transport for testing.
 * Connects a client and server directly without any actual messaging.
 */
export function createInMemoryTransport(): {
	clientTransport: IDBProxyClientTransport;
	serverTransport: IDBProxyServerTransport;
} {
	let requestHandler:
		| ((request: IDBProxyRequest) => Promise<IDBProxyResponse>)
		| null = null;
	let syncHandler: ((message: IDBProxySyncMessage) => void) | null = null;
	const clientId = `single-client-${Date.now()}`;

	const clientTransport: IDBProxyClientTransport = {
		async sendRequest(request): Promise<IDBProxyResponse> {
			if (!requestHandler) {
				return {
					id: request.id,
					type: "error",
					error: "No server handler registered",
				};
			}
			return requestHandler(request);
		},
		onSync(handler): void {
			syncHandler = handler;
		},
	};

	const serverTransport: IDBProxyServerTransport = {
		onRequest(handler): void {
			requestHandler = handler;
		},
		broadcast(message, excludeClientId): void {
			// In single-client transport, only send if the client isn't excluded
			if (syncHandler && excludeClientId !== clientId) {
				syncHandler(message);
			}
		},
	};

	return { clientTransport, serverTransport };
}

/**
 * A broadcast transport that supports multiple clients connecting to one server.
 * Useful for testing N-client scenarios.
 */
export function createMultiClientTransport(): {
	createClientTransport: () => IDBProxyClientTransport;
	serverTransport: IDBProxyServerTransport;
} {
	let requestHandler:
		| ((request: IDBProxyRequest) => Promise<IDBProxyResponse>)
		| null = null;

	// Track all connected clients and their sync handlers
	const clients = new Map<
		string,
		{ syncHandler: ((message: IDBProxySyncMessage) => void) | null }
	>();

	const createClientTransport = (): IDBProxyClientTransport => {
		const clientId = `client-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
		clients.set(clientId, { syncHandler: null });

		return {
			async sendRequest(request: IDBProxyRequest): Promise<IDBProxyResponse> {
				if (!requestHandler) {
					return {
						id: request.id,
						type: "error",
						error: "No server handler registered",
					};
				}
				// Inject clientId into request
				return requestHandler({ ...request, clientId });
			},
			onSync(handler: (message: IDBProxySyncMessage) => void): void {
				const client = clients.get(clientId);
				if (client) {
					client.syncHandler = handler;
				}
			},
			dispose(): void {
				clients.delete(clientId);
			},
		};
	};

	const serverTransport: IDBProxyServerTransport = {
		onRequest(
			handler: (request: IDBProxyRequest) => Promise<IDBProxyResponse>,
		): void {
			requestHandler = handler;
		},
		broadcast(message: IDBProxySyncMessage, excludeClientId: string): void {
			// Send to all clients except the one that initiated the change
			for (const [clientId, client] of clients) {
				if (clientId !== excludeClientId && client.syncHandler) {
					client.syncHandler(message);
				}
			}
		},
		dispose(): void {
			clients.clear();
		},
	};

	return { createClientTransport, serverTransport };
}
