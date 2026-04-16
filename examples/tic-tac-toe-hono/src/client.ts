import { SockaSession } from "@firtoz/socka/client";
import { ticTacToeContract } from "./contract";

function logLine(logEl: HTMLPreElement | null, msg: string): void {
	if (logEl) {
		logEl.textContent = `${msg}\n${logEl.textContent ?? ""}`.slice(0, 4000);
	}
}

/** When opening `index.html` without a host, use this port (matches this example’s server). */
const defaultPort = 3462;

const roomInput = document.querySelector<HTMLInputElement>("#room");
const connectBtn = document.querySelector<HTMLButtonElement>("#connect");
const statusEl = document.querySelector<HTMLParagraphElement>("#status");
const boardEl = document.querySelector<HTMLDivElement>("#board");
const logEl = document.querySelector<HTMLPreElement>("#log");

let session: SockaSession<typeof ticTacToeContract> | null = null;

function renderBoard(): void {
	if (!boardEl) return;
	boardEl.innerHTML = "";
	for (let r = 0; r < 3; r++) {
		const row = document.createElement("div");
		row.className = "row";
		for (let c = 0; c < 3; c++) {
			const cell = document.createElement("button");
			cell.type = "button";
			cell.dataset.row = String(r);
			cell.dataset.col = String(c);
			cell.textContent = " ";
			cell.addEventListener("click", async () => {
				if (!session) return;
				try {
					const out = await session.send.move({
						row: r,
						col: c,
					});
					paintCellButtons(out.board);
					if (statusEl) statusEl.textContent = `${out.status} — turn ${out.turn}`;
				} catch (e) {
					logLine(logEl, e instanceof Error ? e.message : String(e));
				}
			});
			row.appendChild(cell);
		}
		boardEl.appendChild(row);
	}
}

function paintCellButtons(board: readonly string[]): void {
	const buttons = boardEl?.querySelectorAll("button");
	if (!buttons) return;
	buttons.forEach((btn, i) => {
		const b = board[i];
		btn.textContent = b === "" ? " " : b;
		btn.disabled = b !== "";
	});
}

const params = new URLSearchParams(window.location.search);
const defaultRoom = params.get("room") ?? "demo";

if (roomInput) roomInput.value = defaultRoom;

connectBtn?.addEventListener("click", async () => {
	const room = roomInput?.value.trim() || "demo";
	const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
	const host = window.location.host || `localhost:${defaultPort}`;
	const url = `${proto}//${host}/ws/${encodeURIComponent(room)}`;

	if (session) {
		session.close();
		session = null;
	}

	session = new SockaSession({
		contract: ticTacToeContract,
		url,
	});

	session.subscribe.on("stateChanged", (snap) => {
		paintCellButtons(snap.board);
		if (statusEl) statusEl.textContent = `${snap.status} — turn ${snap.turn}`;
	});

	if (statusEl) statusEl.textContent = "Connecting…";
	try {
		renderBoard();
		const out = await session.send.join();
		paintCellButtons(out.board);
		if (statusEl) {
			statusEl.textContent = `You are ${out.you} — ${out.status} — turn ${out.turn}`;
		}
		logLine(logEl, `Joined as ${out.you}`);
	} catch (e) {
		logLine(logEl, e instanceof Error ? e.message : String(e));
		if (statusEl) statusEl.textContent = "Error (see log)";
	}
});
