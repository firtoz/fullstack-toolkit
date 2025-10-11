/**
 * Example: Using ZodWebSocketClient with msgpack buffer messages
 * 
 * This file demonstrates various patterns for using ZodWebSocketClient,
 * including integration with honoDoFetcher for Cloudflare Durable Objects.
 */

import { ZodWebSocketClient } from "@firtoz/websocket-do";
import { honoDoFetcherWithName } from "@firtoz/hono-fetcher";
import { z } from "zod";
import { useEffect, useState } from "react";

// Define your message schemas (should match server schemas)
const ClientMessageSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("message"),
		text: z.string().min(1).max(1000),
	}),
	z.object({
		type: z.literal("setName"),
		name: z.string().min(1).max(50),
	}),
]);

const ServerMessageSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("userJoined"),
		name: z.string(),
		userId: z.string(),
	}),
	z.object({
		type: z.literal("userLeft"),
		name: z.string(),
		userId: z.string(),
	}),
	z.object({
		type: z.literal("message"),
		text: z.string(),
		from: z.string(),
		userId: z.string(),
	}),
	z.object({
		type: z.literal("nameChanged"),
		oldName: z.string(),
		newName: z.string(),
		userId: z.string(),
	}),
	z.object({
		type: z.literal("error"),
		message: z.string(),
	}),
]);

type ClientMessage = z.infer<typeof ClientMessageSchema>;
type ServerMessage = z.infer<typeof ServerMessageSchema>;

// Example 1: Buffer mode (msgpack) client
// @ts-ignore - this is only an example
function createBufferClient() {
	const client = new ZodWebSocketClient<ClientMessage, ServerMessage>({
		url: "wss://your-server.com/websocket",
		clientSchema: ClientMessageSchema,
		serverSchema: ServerMessageSchema,
		enableBufferMessages: true, // Use msgpack!
		
		onMessage: (msg) => {
			// Type-safe message handling
			switch (msg.type) {
				case "message":
					console.log(`${msg.from}: ${msg.text}`);
					break;
				case "userJoined":
					console.log(`${msg.name} joined`);
					break;
				case "userLeft":
					console.log(`${msg.name} left`);
					break;
				case "nameChanged":
					console.log(`${msg.oldName} changed name to ${msg.newName}`);
					break;
				case "error":
					console.error(`Error: ${msg.message}`);
					break;
			}
		},
		
		onOpen: () => {
			console.log("Connected!");
			// Send a message after connecting
			client.send({ type: "setName", name: "Alice" });
		},
		
		onClose: (event) => {
			console.log("Disconnected:", event.code, event.reason);
		},
		
		onError: (event) => {
			console.error("WebSocket error:", event);
		},
		
		onValidationError: (error, rawMessage) => {
			console.error("Validation error:", error);
			console.error("Raw message:", rawMessage);
		},
	});

	return client;
}

// Example 2: JSON mode client
// @ts-ignore - this is only an example
function createJsonClient() {
	const client = new ZodWebSocketClient<ClientMessage, ServerMessage>({
		url: "wss://your-server.com/websocket",
		clientSchema: ClientMessageSchema,
		serverSchema: ServerMessageSchema,
		enableBufferMessages: false, // JSON mode
		
		onMessage: (msg) => {
			console.log("Received:", msg);
		},
		
		onOpen: () => {
			console.log("Connected in JSON mode!");
		},
	});

	return client;
}

// Example 3: Using async/await with the client
// @ts-ignore - this is only an example
async function exampleAsyncUsage() {
	const client = new ZodWebSocketClient<ClientMessage, ServerMessage>({
		url: "wss://your-server.com/websocket",
		clientSchema: ClientMessageSchema,
		serverSchema: ServerMessageSchema,
		enableBufferMessages: true,
	});

	// Wait for connection to open
	await client.waitForOpen();
	
	console.log("Connection established!");

	// Send messages
	client.send({ type: "setName", name: "Bob" });
	client.send({ type: "message", text: "Hello, everyone!" });

	// Later, close the connection
	setTimeout(() => {
		client.close(1000, "Goodbye!");
	}, 5000);
}

// Example 4: Integration with honoDoFetcher (Durable Objects)
// @ts-ignore - this is only an example
async function connectToDurableObject(env: any, roomName: string) {
	// Step 1: Use honoDoFetcher to get WebSocket connection
	const api = honoDoFetcherWithName(env.CHAT_ROOM, roomName);
    // @ts-ignore - this is only an example
	const wsResp = await api.websocket({
		url: "/websocket",
		config: { autoAccept: false }, // Let ZodWebSocketClient control acceptance
	});

	if (!wsResp.webSocket) {
		throw new Error("Failed to establish WebSocket connection");
	}

	// Step 2: Wrap with ZodWebSocketClient for type-safe messaging
	const client = new ZodWebSocketClient<ClientMessage, ServerMessage>({
		webSocket: wsResp.webSocket, // Use existing WebSocket!
		clientSchema: ClientMessageSchema,
		serverSchema: ServerMessageSchema,
		enableBufferMessages: true, // Use msgpack for efficiency
		
		onMessage: (msg) => {
			switch (msg.type) {
				case "message":
					console.log(`[${msg.from}]: ${msg.text}`);
					break;
				case "userJoined":
					console.log(`✅ ${msg.name} joined the room`);
					break;
				case "userLeft":
					console.log(`❌ ${msg.name} left the room`);
					break;
				case "nameChanged":
					console.log(`📝 ${msg.oldName} → ${msg.newName}`);
					break;
				case "error":
					console.error(`⚠️ ${msg.message}`);
					break;
			}
		},
		
		onValidationError: (error) => {
			console.error("❌ Message validation failed:", error);
		},
	});

	// Step 3: Accept the WebSocket connection
	wsResp.webSocket.accept();

	// Step 4: Wait for connection to be ready
	await client.waitForOpen();
	console.log("🔗 Connected to Durable Object:", roomName);

	// Step 5: Send type-safe messages
	client.send({ type: "setName", name: "Alice" });
	client.send({ type: "message", text: "Hello from typed client!" });

	return client;
}

// Example 5: React hook pattern
// @ts-ignore - this is only an example
function useWebSocketChat(url: string) {
	const [messages, setMessages] = useState<ServerMessage[]>([]);
	const [client, setClient] = useState<ZodWebSocketClient<ClientMessage, ServerMessage> | null>(null);

	useEffect(() => {
		const ws = new ZodWebSocketClient<ClientMessage, ServerMessage>({
			url,
			clientSchema: ClientMessageSchema,
			serverSchema: ServerMessageSchema,
			enableBufferMessages: true,
			
			onMessage: (msg) => {
				setMessages(prev => [...prev, msg]);
			},
		});

		setClient(ws);

		return () => {
			ws.close();
		};
	}, [url]);

	const sendMessage = (text: string) => {
		client?.send({ type: "message", text });
	};

	const setName = (name: string) => {
		client?.send({ type: "setName", name });
	};

	return { messages, sendMessage, setName, client };
}

// Example 6: React hook with honoDoFetcher integration
// @ts-ignore - this is only an example
function useDurableObjectChat(env: any, roomName: string) {
	const [messages, setMessages] = useState<ServerMessage[]>([]);
	const [client, setClient] = useState<ZodWebSocketClient<ClientMessage, ServerMessage> | null>(null);
	const [isConnected, setIsConnected] = useState(false);

	useEffect(() => {
		let mounted = true;

		const connect = async () => {
			try {
				// Connect via honoDoFetcher
				const api = honoDoFetcherWithName(env.CHAT_ROOM, roomName);
				// @ts-ignore - this is only an example
				const wsResp = await api.websocket({
					url: "/websocket",
					config: { autoAccept: false },
				});

				if (!mounted || !wsResp.webSocket) return;

				// Wrap with ZodWebSocketClient
				const ws = new ZodWebSocketClient<ClientMessage, ServerMessage>({
					webSocket: wsResp.webSocket,
					clientSchema: ClientMessageSchema,
					serverSchema: ServerMessageSchema,
					enableBufferMessages: true,
					
					onMessage: (msg) => {
						if (mounted) {
							setMessages(prev => [...prev, msg]);
						}
					},
					
					onOpen: () => {
						if (mounted) {
							setIsConnected(true);
						}
					},
					
					onClose: () => {
						if (mounted) {
							setIsConnected(false);
						}
					},
				});

				wsResp.webSocket.accept();
				await ws.waitForOpen();

				if (mounted) {
					setClient(ws);
				}
			} catch (error) {
				console.error("Failed to connect:", error);
			}
		};

		connect();

		return () => {
			mounted = false;
			client?.close();
		};
	}, [env, roomName]);

	const sendMessage = (text: string) => {
		client?.send({ type: "message", text });
	};

	const setName = (name: string) => {
		client?.send({ type: "setName", name });
	};

	return { messages, sendMessage, setName, client, isConnected };
}

// Example 7: Error handling and reconnection
// @ts-ignore - this is only an example
function createRobustClient() {
	let reconnectAttempts = 0;
	const maxReconnectAttempts = 5;

	function connect(): ZodWebSocketClient<ClientMessage, ServerMessage> {
		const client = new ZodWebSocketClient<ClientMessage, ServerMessage>({
			url: "wss://your-server.com/websocket",
			clientSchema: ClientMessageSchema,
			serverSchema: ServerMessageSchema,
			enableBufferMessages: true,
			
			onMessage: (msg) => {
				reconnectAttempts = 0; // Reset on successful message
				console.log("Message:", msg);
			},
			
			onClose: (_event) => {
				if (reconnectAttempts < maxReconnectAttempts) {
					reconnectAttempts++;
					console.log(`Reconnecting... (attempt ${reconnectAttempts})`);
					setTimeout(() => {
						connect();
					}, 1000 * reconnectAttempts); // Exponential backoff
				} else {
					console.error("Max reconnection attempts reached");
				}
			},
			
			onValidationError: (error, _rawMessage) => {
				// Log validation errors but don't disconnect
				console.error("Invalid message received:", error);
			},
		});

		return client;
	}

	return connect();
}

