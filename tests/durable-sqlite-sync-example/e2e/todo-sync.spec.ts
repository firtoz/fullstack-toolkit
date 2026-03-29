import { expect, test } from "@playwright/test";

function roomUrl(name: string, options?: { transport?: "msgpack" }): string {
	let q = `/?backend=memory&room=${encodeURIComponent(name)}`;
	if (options?.transport === "msgpack") {
		q += "&transport=msgpack";
	}
	return q;
}

/** Isolated room per test so parallel workers do not share one Durable Object. */
function uniqueRoom(base: string): string {
	return `${base}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

test("msgpack websocket transport syncs todos", async ({ page }) => {
	const room = uniqueRoom("msgpack-ws");
	await page.goto(roomUrl(room, { transport: "msgpack" }));
	await expect(page.getByText("WebSocket transport:")).toContainText("msgpack");
	await page.getByPlaceholder("Add todo").fill("msgpack todo");
	await page.getByRole("button", { name: "Add" }).click();
	await expect(
		page.locator("li").filter({ hasText: "msgpack todo" }).first(),
	).toBeVisible();
	await expect(page.locator("pre")).toContainText("[msgpack");
});

test("online multi-client sync", async ({ browser }) => {
	const room = uniqueRoom("online-multi-client");
	const c1 = await browser.newContext();
	const c2 = await browser.newContext();
	const p1 = await c1.newPage();
	const p2 = await c2.newPage();

	await p1.goto(roomUrl(room));
	await p2.goto(roomUrl(room));

	await p1.getByPlaceholder("Add todo").fill("buy milk");
	await p1.getByRole("button", { name: "Add" }).click();

	await expect(
		p1.locator("li").filter({ hasText: "buy milk" }).first(),
	).toBeVisible();
	await expect(
		p2.locator("li").filter({ hasText: "buy milk" }).first(),
	).toBeVisible();
	await expect(p1.locator("pre")).toContainText("mutateBatch");
	await expect(p2.locator("pre")).toContainText("syncBackfill");

	await c1.close();
	await c2.close();
});

test("offline reconnect replay syncs queued local edits", async ({ browser }) => {
	const room = uniqueRoom("offline-replay");
	const c1 = await browser.newContext();
	const c2 = await browser.newContext();
	const p1 = await c1.newPage();
	const p2 = await c2.newPage();

	await p1.goto(roomUrl(room));
	await p2.goto(roomUrl(room));

	await p1.getByPlaceholder("Add todo").fill("offline item");
	await p1.getByRole("button", { name: "Add" }).click();
	await expect(
		p2.locator("li").filter({ hasText: "offline item" }).first(),
	).toBeVisible();

	await c1.setOffline(true);
	await p1.getByLabel(/^edit-/).first().click();
	await p1.getByPlaceholder("Edit todo").fill("offline item (edited)");
	await p1.getByRole("button", { name: "Save" }).click();
	await expect(p1.locator("li").first()).toContainText("offline item (edited)");

	await c1.setOffline(false);
	await p1.reload();
	await expect(
		p2.locator("li").filter({ hasText: "offline item (edited)" }).first(),
	).toBeVisible();

	await c1.close();
	await c2.close();
});

test("reconnect backfill catches up remote changes", async ({ browser }) => {
	const room = uniqueRoom("reconnect-backfill");
	const c1 = await browser.newContext();
	const c2 = await browser.newContext();
	const p1 = await c1.newPage();
	const p2 = await c2.newPage();

	await p1.goto(roomUrl(room));
	await p2.goto(roomUrl(room));

	await c1.setOffline(true);
	await p2.getByPlaceholder("Add todo").fill("while client1 offline");
	await p2.getByRole("button", { name: "Add" }).click();
	await expect(
		p2.locator("li").filter({ hasText: "while client1 offline" }).first(),
	).toBeVisible();

	await c1.setOffline(false);
	await p1.reload();
	await expect(
		p1.locator("li").filter({ hasText: "while client1 offline" }).first(),
	).toBeVisible();

	await c1.close();
	await c2.close();
});

test("same-record edits converge to latest updatedAt (LWW)", async ({
	browser,
}) => {
	const room = uniqueRoom("lww-convergence");
	const c1 = await browser.newContext();
	const c2 = await browser.newContext();
	const p1 = await c1.newPage();
	const p2 = await c2.newPage();

	await p1.goto(roomUrl(room));
	await p2.goto(roomUrl(room));

	await p1.getByPlaceholder("Add todo").fill("conflict item");
	await p1.getByRole("button", { name: "Add" }).click();
	await expect(
		p2.locator("li").filter({ hasText: "conflict item" }).first(),
	).toBeVisible();

	await p2.getByLabel(/^edit-/).first().click();
	await p2.getByPlaceholder("Edit todo").fill("conflict item (p2 edit)");
	await p2.getByRole("button", { name: "Save" }).click();
	await p1.waitForTimeout(50);
	await p1.getByLabel(/^edit-/).first().click();
	await p1.getByPlaceholder("Edit todo").fill("conflict item (p1 edit)");
	await p1.getByRole("button", { name: "Save" }).click();

	await expect(p1.locator("li").first()).toContainText("conflict item (p1 edit)");
	await expect(p2.locator("li").first()).toContainText("conflict item (p1 edit)");

	await c1.close();
	await c2.close();
});
