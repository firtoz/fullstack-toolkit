/**
 * Minimal fake WebSocket for unit tests (not published).
 */
type Listener = (event: Event) => void;

export function createFakeWebSocket(
	initialReadyState: number = WebSocket.CONNECTING,
): {
	socket: WebSocket;
	sent: (string | ArrayBuffer | Blob)[];
	dispatchMessage: (data: string | ArrayBuffer) => void;
	dispatchOpen: () => void;
	dispatchClose: () => void;
	setReadyState: (state: number) => void;
} {
	const sent: (string | ArrayBuffer | Blob)[] = [];
	const listeners = new Map<string, Set<Listener>>();

	let readyState: number = initialReadyState;

	const addListener = (type: string, listener: Listener) => {
		let set = listeners.get(type);
		if (!set) {
			set = new Set();
			listeners.set(type, set);
		}
		set.add(listener);
	};

	const socket = {
		binaryType: "blob",
		get readyState() {
			return readyState;
		},
		addEventListener(
			type: string,
			listener: EventListenerOrEventListenerObject,
			_options?: boolean | AddEventListenerOptions,
		): void {
			const fn =
				typeof listener === "function"
					? listener
					: (ev: Event) => listener.handleEvent(ev);
			addListener(type, fn as Listener);
		},
		removeEventListener(
			type: string,
			listener: EventListenerOrEventListenerObject,
			_options?: boolean | EventListenerOptions,
		): void {
			const set = listeners.get(type);
			if (!set) return;
			const fn =
				typeof listener === "function"
					? listener
					: (ev: Event) => listener.handleEvent(ev);
			set.delete(fn as Listener);
		},
		send(data: string | ArrayBuffer | Blob | ArrayBufferView): void {
			if (ArrayBuffer.isView(data)) {
				const v = data;
				const copy = new ArrayBuffer(v.byteLength);
				new Uint8Array(copy).set(
					new Uint8Array(v.buffer, v.byteOffset, v.byteLength),
				);
				sent.push(copy);
				return;
			}
			sent.push(data);
		},
		close(_code?: number, _reason?: string): void {
			// no-op for tests unless needed
		},
		dispatchEvent(event: Event): boolean {
			const set = listeners.get(event.type);
			if (!set) return true;
			for (const l of set) {
				l(event);
			}
			return !event.defaultPrevented;
		},
	} as unknown as WebSocket;

	const dispatchMessage = (data: string | ArrayBuffer): void => {
		const ev = new MessageEvent("message", { data });
		socket.dispatchEvent(ev);
	};

	const dispatchOpen = (): void => {
		readyState = WebSocket.OPEN;
		socket.dispatchEvent(new Event("open"));
	};

	const dispatchClose = (): void => {
		readyState = WebSocket.CLOSED;
		socket.dispatchEvent(new CloseEvent("close", { code: 1000 }));
	};

	const setReadyState = (state: number): void => {
		readyState = state;
	};

	return {
		socket,
		sent,
		dispatchMessage,
		dispatchOpen,
		dispatchClose,
		setReadyState,
	};
}
