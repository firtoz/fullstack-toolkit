export class WebsocketWrapper<TAttachment, TMessage> {
	public constructor(public webSocket: WebSocket) {}

	public send(message: TMessage) {
		if (this.webSocket.readyState !== WebSocket.OPEN) return;
		this.webSocket.send(JSON.stringify(message));
	}

	public deserializeAttachment() {
		return this.webSocket.deserializeAttachment() as TAttachment;
	}

	public serializeAttachment(attachment: TAttachment) {
		this.webSocket.serializeAttachment(attachment);
	}
}
