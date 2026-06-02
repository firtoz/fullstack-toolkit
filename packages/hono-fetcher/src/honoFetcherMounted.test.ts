import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { honoFetcher } from "./honoFetcher";
import { honoFetcherMounted } from "./honoFetcherMounted";

const publicUsers = {
	scope: "public" as const,
	users: [{ id: "1", name: "Ada" }],
};

const adminUsers = {
	scope: "admin" as const,
	users: [{ id: "1", name: "Ada", role: "moderator" as const }],
};

const adminUserDetail = {
	id: "1",
	name: "Ada",
	role: "moderator" as const,
	auditLog: ["joined"],
};

const adminSomethingElse = {
	feature: "admin-only" as const,
	source: "audit-export",
};

const level1Foo = {
	scope: "foo" as const,
	level: "room-1",
};

const level1Bar = {
	scope: "bar" as const,
	level: "room-1",
};

const deepFoo = { nested: "deep-foo" as const };
const deepBar = { nested: "deep-bar" as const };

/** Sub-app routes (no `/admin` prefix on schema keys). */
const adminSubApp = new Hono()
	.get("/users", (c) => c.json(adminUsers))
	.get("/users/:id", (c) =>
		c.json({ ...adminUserDetail, id: c.req.param("id") }),
	)
	.get("/somethingelse", (c) => c.json(adminSomethingElse));

const deepSubApp = new Hono()
	.get("/foo", (c) => c.json(deepFoo))
	.get("/bar", (c) => c.json(deepBar));

const accountSubApp = new Hono()
	.get("/", (c) => c.json({ account: "root", query: c.req.query() }))
	.get("/sessions", (c) =>
		c.json({ account: "sessions", query: c.req.query() }),
	);

const level1SubApp = new Hono()
	.get("/foo", (c) => c.json({ ...level1Foo, level: c.req.param("param") }))
	.get("/bar", (c) => c.json({ ...level1Bar, level: c.req.param("param") }));

/** Worker app with full paths — used for typed mount prefixes. */
const workerApp = new Hono()
	.get("/users", (c) => c.json(publicUsers))
	.route("/admin", adminSubApp)
	.route("/nested/deep", deepSubApp)
	.route("/level1/:param", level1SubApp)
	.get("/x", (c) => c.json({ tag: "x" }))
	.get("/y", (c) => c.json({ tag: "y" }))
	.get("/a/b", (c) => c.json({ nested: "b" }))
	.get("/a/c", (c) => c.json({ nested: "c" }))
	.get("/a/:d", (c) => c.json({ param: c.req.param("d") }));

describe("honoFetcherMounted", () => {
	it("returns public vs admin payloads from the correct prefixed URLs", async () => {
		const worker = honoFetcher<typeof workerApp>((url, init) =>
			workerApp.request(url, init),
		);
		const admin = honoFetcherMounted(workerApp, "/admin");

		const pub = await worker.get({ url: "/users" });
		expect(await pub.json()).toEqual(publicUsers);

		const adm = await admin.get({ url: "/users" });
		expect(await adm.json()).toEqual(adminUsers);

		const detail = await admin.get({
			url: "/users/:id",
			params: { id: "1" },
		});
		expect(await detail.json()).toEqual(adminUserDetail);

		const workerAdminOnly = await worker.get({ url: "/admin/somethingelse" });
		expect(await workerAdminOnly.json()).toEqual(adminSomethingElse);

		const adminOnly = await admin.get({ url: "/somethingelse" });
		expect(await adminOnly.json()).toEqual(adminSomethingElse);
	});

	it("sub-app type + external mount prefix still prefixes fetch URLs", async () => {
		const requests: string[] = [];
		const admin = honoFetcherMounted<typeof adminSubApp>((url, init) => {
			requests.push(url);
			return workerApp.request(url, init);
		}, "/admin");

		await admin.get({ url: "/users" });
		await admin.get({ url: "/users/:id", params: { id: "1" } });
		await admin.get({ url: "/somethingelse" });

		expect(requests).toEqual([
			"/admin/users",
			"/admin/users/1",
			"/admin/somethingelse",
		]);

		const list = await admin.get({ url: "/users" });
		expect(await list.json()).toEqual(adminUsers);
	});

	it("normalizes mount path without trailing slash", async () => {
		const requests: string[] = [];
		const client = honoFetcherMounted<typeof adminSubApp>((url, init) => {
			requests.push(url);
			return workerApp.request(url, init);
		}, "admin/");

		await client.get({ url: "/users" });
		expect(requests).toEqual(["/admin/users"]);
	});

	it("joins mounted root and query strings without adding a trailing slash", async () => {
		const requests: string[] = [];
		const account = honoFetcherMounted<typeof accountSubApp>((url) => {
			requests.push(url);
			return new Response("{}");
		}, "/api/account");

		await account.get({ url: "/", query: { includeSessions: "1" } });
		await account.get({ url: "/" });
		await account.get({ url: "/sessions" });
		await account.get({ url: "/sessions", query: { foo: "1" } });

		expect(requests).toEqual([
			"/api/account?includeSessions=1",
			"/api/account",
			"/api/account/sessions",
			"/api/account/sessions?foo=1",
		]);
	});

	it("preserves root requests when mounted at the parent root", async () => {
		const requests: string[] = [];
		const account = honoFetcherMounted<typeof accountSubApp>((url) => {
			requests.push(url);
			return new Response("{}");
		}, "");

		await account.get({ url: "/", query: { q: "1" } });
		await account.get({ url: "/" });

		expect(requests).toEqual(["/?q=1", "/"]);
	});

	it("typed mount exposes only routes under the prefix", async () => {
		const aClient = honoFetcherMounted(workerApp, "/a");

		const b = await aClient.get({ url: "/b" });
		expect(await b.json()).toEqual({ nested: "b" });

		const c = await aClient.get({ url: "/c" });
		expect(await c.json()).toEqual({ nested: "c" });

		const d = await aClient.get({ url: "/:d", params: { d: "room-1" } });
		expect(await d.json()).toEqual({ param: "room-1" });
	});

	it("binds multi-segment mount prefixes", async () => {
		const worker = honoFetcher<typeof workerApp>((url, init) =>
			workerApp.request(url, init),
		);
		const deep = honoFetcherMounted(workerApp, "/nested/deep");

		const workerDeep = await worker.get({ url: "/nested/deep/foo" });
		expect(await workerDeep.json()).toEqual(deepFoo);

		const foo = await deep.get({ url: "/foo" });
		expect(await foo.json()).toEqual(deepFoo);

		const bar = await deep.get({ url: "/bar" });
		expect(await bar.json()).toEqual(deepBar);
	});

	it("binds parametric mount prefixes with mountParams", async () => {
		const worker = honoFetcher<typeof workerApp>((url, init) =>
			workerApp.request(url, init),
		);
		const level1 = honoFetcherMounted(workerApp, "/level1/:param", {
			param: "room-1",
		});

		const workerFoo = await worker.get({
			url: "/level1/:param/foo",
			params: { param: "room-1" },
		});
		expect(await workerFoo.json()).toEqual(level1Foo);

		const foo = await level1.get({ url: "/foo" });
		expect(await foo.json()).toEqual(level1Foo);

		const bar = await level1.get({ url: "/bar" });
		expect(await bar.json()).toEqual(level1Bar);
	});

	it("sub-app type + parametric mount prefix prefixes fetch URLs", async () => {
		const requests: string[] = [];
		const level1 = honoFetcherMounted<typeof level1SubApp>(
			(url, init) => {
				requests.push(url);
				return workerApp.request(url, init);
			},
			"/level1/:param",
			{ param: "room-1" },
		);

		await level1.get({ url: "/foo" });
		await level1.get({ url: "/bar" });

		expect(requests).toEqual(["/level1/room-1/foo", "/level1/room-1/bar"]);
	});
});
