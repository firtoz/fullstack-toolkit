import { SockaSession } from "@firtoz/socka/client";
import { chatContract } from "./contract";

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

/** Format persisted / server message time for the log. */
function formatMsgTime(ts: number): string {
	const d = new Date(ts);
	const now = new Date();
	const sameDay =
		d.getFullYear() === now.getFullYear() &&
		d.getMonth() === now.getMonth() &&
		d.getDate() === now.getDate();
	if (sameDay) {
		return d.toLocaleTimeString(undefined, {
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});
	}
	return d.toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function formatEventTime(): string {
	return new Date().toLocaleTimeString(undefined, {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
}

function logLine(logEl: HTMLPreElement, line: string): void {
	logEl.textContent = `${line}\n${logEl.textContent ?? ""}`.slice(0, 12000);
}

function renderPresenceList(
	listEl: HTMLUListElement,
	selfUserId: string,
	onlineById: Map<string, string>,
): void {
	listEl.replaceChildren();
	const users = Array.from(onlineById.entries()).map(([userId, displayName]) => ({
		userId,
		displayName,
	}));
	users.sort((a, b) => a.displayName.localeCompare(b.displayName));
	for (const u of users) {
		const li = document.createElement("li");
		li.className = u.userId === selfUserId ? "self" : "";
		li.textContent = `${u.displayName}${u.userId === selfUserId ? " (you)" : ""}`;
		listEl.appendChild(li);
	}
}

function setConnStatus(
	el: HTMLDivElement,
	state: "connecting" | "connected" | "disconnected" | "error",
	label: string,
): void {
	el.textContent = label;
	el.className = `conn-status ${state}`;
}

const panesEl = document.querySelector<HTMLDivElement>("#panes");
const roomInput = document.querySelector<HTMLInputElement>("#room");
const nameInput = document.querySelector<HTMLInputElement>("#name");

function addPane(room: string, displayName: string): void {
	if (!panesEl) return;

	const wrap = document.createElement("section");
	wrap.className = "pane";
	const body = document.createElement("div");
	body.className = "pane-body";
	const main = document.createElement("div");
	main.className = "pane-main";
	const aside = document.createElement("aside");
	aside.className = "presence-aside";

	const title = document.createElement("h2");
	title.className = "pane-room-title";
	title.textContent = room;

	const statusEl = document.createElement("div");
	setConnStatus(statusEl, "connecting", "Connecting…");

	const urlEl = document.createElement("div");
	urlEl.className = "ws-url";

	const logEl = document.createElement("pre");
	logEl.className = "log";
	const composer = document.createElement("div");
	composer.className = "composer";
	const rowPrimary = document.createElement("div");
	rowPrimary.className = "composer-row composer-row--primary";
	const rowSecondary = document.createElement("div");
	rowSecondary.className = "composer-row composer-row--secondary";
	const inputEl = document.createElement("input");
	inputEl.type = "text";
	inputEl.className = "msg";
	inputEl.placeholder = "Message";
	inputEl.disabled = true;
	const sendBtn = document.createElement("button");
	sendBtn.type = "button";
	sendBtn.className = "btn-send";
	sendBtn.textContent = "Send";
	sendBtn.disabled = true;
	const clearBtn = document.createElement("button");
	clearBtn.type = "button";
	clearBtn.className = "btn-secondary";
	clearBtn.textContent = "Clear history";
	clearBtn.disabled = true;
	const discBtn = document.createElement("button");
	discBtn.type = "button";
	discBtn.className = "btn-secondary btn-disc";
	discBtn.textContent = "Disconnect";
	rowPrimary.appendChild(inputEl);
	rowPrimary.appendChild(sendBtn);
	rowSecondary.appendChild(clearBtn);
	rowSecondary.appendChild(discBtn);
	composer.appendChild(rowPrimary);
	composer.appendChild(rowSecondary);

	const presenceHeading = document.createElement("h3");
	presenceHeading.textContent = "Online";
	const presenceListEl = document.createElement("ul");
	presenceListEl.className = "presence-list";

	main.appendChild(title);
	main.appendChild(statusEl);
	main.appendChild(urlEl);
	main.appendChild(logEl);
	main.appendChild(composer);

	aside.appendChild(presenceHeading);
	aside.appendChild(presenceListEl);

	body.appendChild(main);
	body.appendChild(aside);
	wrap.appendChild(body);
	panesEl.appendChild(wrap);

	const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
	const host = window.location.host || "localhost:3465";
	const url = `${proto}//${host}/ws/${encodeURIComponent(room)}?name=${encodeURIComponent(displayName)}`;
	urlEl.textContent = url;

	const onlineById = new Map<string, string>();
	let selfUserId = "";

	const session = new SockaSession({
		contract: chatContract,
		url,
		onOpen: () => {
			setConnStatus(statusEl, "connected", "Connected");
			inputEl.disabled = false;
			sendBtn.disabled = false;
			clearBtn.disabled = false;
		},
		onClose: () => {
			setConnStatus(statusEl, "disconnected", "Disconnected");
			inputEl.disabled = true;
			sendBtn.disabled = true;
			clearBtn.disabled = true;
		},
		onError: () => {
			setConnStatus(statusEl, "error", "WebSocket error");
			inputEl.disabled = true;
			sendBtn.disabled = true;
			clearBtn.disabled = true;
		},
	});

	session.subscribe.on("userJoined", (p) => {
		onlineById.set(p.userId, p.displayName);
		renderPresenceList(presenceListEl, selfUserId, onlineById);
		logLine(
			logEl,
			`[${formatEventTime()}] [join] ${escapeHtml(p.displayName)}`,
		);
	});
	session.subscribe.on("userLeft", (p) => {
		onlineById.delete(p.userId);
		renderPresenceList(presenceListEl, selfUserId, onlineById);
		logLine(
			logEl,
			`[${formatEventTime()}] [leave] ${escapeHtml(p.displayName)}`,
		);
	});
	session.subscribe.on("roomMessage", (m) =>
		logLine(
			logEl,
			`[${formatMsgTime(m.ts)}] ${escapeHtml(m.displayName)}: ${escapeHtml(m.text)}`,
		),
	);
	session.subscribe.on("historyCleared", (p) => {
		logEl.textContent = "";
		logLine(
			logEl,
			`[${formatMsgTime(p.ts)}] [history cleared] ${escapeHtml(p.clearedByDisplayName)}`,
		);
	});

	void session.client.waitForOpen().then(async () => {
		try {
			const { messages } = await session.send.listHistory({ limit: 100 });
			for (const m of messages) {
				logLine(
					logEl,
					`[${formatMsgTime(m.ts)}] [history] ${escapeHtml(m.displayName)}: ${escapeHtml(m.text)}`,
				);
			}
			const pres = await session.send.listPresence({});
			selfUserId = pres.selfUserId;
			onlineById.clear();
			for (const u of pres.users) {
				onlineById.set(u.userId, u.displayName);
			}
			renderPresenceList(presenceListEl, selfUserId, onlineById);
		} catch (e) {
			logLine(logEl, e instanceof Error ? e.message : String(e));
		}
	});

	sendBtn.addEventListener("click", async () => {
		const text = inputEl.value.trim();
		if (!text) return;
		try {
			await session.send.sendMessage({ text });
			inputEl.value = "";
		} catch (e) {
			logLine(logEl, e instanceof Error ? e.message : String(e));
		}
	});

	clearBtn.addEventListener("click", async () => {
		try {
			await session.send.clearHistory({});
		} catch (e) {
			logLine(logEl, e instanceof Error ? e.message : String(e));
		}
	});

	discBtn.addEventListener("click", () => {
		session.close();
		wrap.remove();
	});

	inputEl.addEventListener("keydown", (ev) => {
		if (ev.key === "Enter") sendBtn.click();
	});
}

document.querySelector("#add")?.addEventListener("click", () => {
	const room = roomInput?.value.trim() || "lobby";
	const name = nameInput?.value.trim() || "Guest";
	addPane(room, name);
});
