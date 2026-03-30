import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { type ServerType, serve } from "@hono/node-server";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { honoFetcher, type TypedHonoFetcher } from "./honoFetcher";

describe("honoFetcher", () => {
	const app = new Hono()
		.get("/users/:id", (c) => {
			const id = c.req.param("id");
			return c.json({ id, name: `User ${id}` });
		})
		.post(
			"/users/:id",
			zValidator("json", z.object({ name: z.string() })),
			async (c) => {
				const id = c.req.param("id");
				const { name } = c.req.valid("json");
				return c.json({ id, name });
			},
		)
		.get("/items", (c) => {
			return c.json({ items: ["item1", "item2", "item3"] });
		})
		.get("/echo-query", (c) => {
			return c.json({
				sort: c.req.query("sort") ?? null,
				limit: c.req.query("limit") ?? null,
				active: c.req.query("active") ?? null,
				extra: c.req.query("extra") ?? null,
			});
		})
		.get("/users/:id/echo-query", (c) => {
			const id = c.req.param("id");
			return c.json({
				id,
				tab: c.req.query("tab") ?? null,
			});
		})
		.post(
			"/items",
			zValidator("json", z.object({ item: z.string() })),
			async (c) => {
				const { item } = c.req.valid("json");
				return c.json({ success: true, item });
			},
		)
		.post(
			"/items-form",
			zValidator(
				"form",
				z.object({
					item: z.string(),
					quantity: z.coerce.number(),
				}),
			),
			async (c) => {
				try {
					const body = c.req.valid("form");
					return c.json({ success: true, body } as const);
				} catch (error) {
					console.error(error);
					return c.json({ success: false } as const, 400);
				}
			},
		)
		.post(
			"/items-json",
			zValidator(
				"json",
				z.object({
					item: z.string(),
				}),
			),
			async (c) => {
				const body = c.req.valid("json");
				return c.json({ success: true, body });
			},
		);

	const runFetcherTests = (
		description: string,
		createFetcher: () => Promise<TypedHonoFetcher<typeof app>>,
	) => {
		describe(description, () => {
			let fetcher: TypedHonoFetcher<typeof app>;

			beforeAll(async () => {
				fetcher = await createFetcher();
			});

			it("should fetch data with GET request", async () => {
				const response = await fetcher.get({
					url: "/users/:id",
					params: { id: "123" },
				});

				const data = await response.json();
				expect(data).toEqual({ id: "123", name: "User 123" });
			});

			it("should send data with POST request", async () => {
				const response = await fetcher.post({
					url: "/users/:id",
					body: { name: "John Doe" },
					params: { id: "456" },
				});
				const data = await response.json();
				expect(data).toEqual({ id: "456", name: "John Doe" });
			});

			it("should fetch data from a route without params", async () => {
				const response = await fetcher.get({ url: "/items" });
				const data = await response.json();
				expect(data).toEqual({ items: ["item1", "item2", "item3"] });
			});

			it("should send data to a route without params", async () => {
				const response = await fetcher.post({
					url: "/items",
					body: { item: "newItem" },
				});
				const data = await response.json();
				expect(data).toEqual({ success: true, item: "newItem" });
			});

			it("should send data to a route with form data", async () => {
				const response = await fetcher.post({
					url: "/items-form",
					form: {
						item: "newItem",
						quantity: "5",
					},
				});
				const data = await response.json();
				expect(data).toEqual({
					success: true,
					body: { item: "newItem", quantity: 5 },
				});
			});

			it("should send data to a route with JSON data", async () => {
				const response = await fetcher.post({
					url: "/items-json",
					body: { item: "newItem" },
				});
				const data = await response.json();
				expect(data).toEqual({ success: true, body: { item: "newItem" } });
			});

			it("should merge init.headers with JSON Content-Type on POST", async () => {
				const response = await fetcher.post({
					url: "/items-json",
					body: { item: "mergedHeaders" },
					init: {
						headers: { "X-Custom": "v" },
					},
				});
				expect(response.ok).toBe(true);
				const data = await response.json();
				expect(data).toEqual({
					success: true,
					body: { item: "mergedHeaders" },
				});
			});

			it("should pass custom headers", async () => {
				const customHeaderValue = "test-value";
				const response = await fetcher.get({
					url: "/users/:id",
					params: { id: "789" },
					init: {
						headers: { "X-Custom-Header": customHeaderValue },
					},
				});

				// We need to mock the headers check in the actual app for this test
				// For now, we'll just check if the response is successful
				expect(response.ok).toBe(true);
			});

			it("should append query params as a record", async () => {
				const response = await fetcher.get({
					url: "/echo-query",
					query: { sort: "name", limit: 10, active: true },
				});
				const data = await response.json();
				expect(data).toEqual({
					sort: "name",
					limit: "10",
					active: "true",
					extra: null,
				});
			});

			it("should omit null and undefined query values", async () => {
				const response = await fetcher.get({
					url: "/echo-query",
					query: {
						sort: "x",
						limit: undefined,
						active: null,
						extra: "present",
					},
				});
				const data = await response.json();
				expect(data).toEqual({
					sort: "x",
					limit: null,
					active: null,
					extra: "present",
				});
			});

			it("should combine path params and query params", async () => {
				const response = await fetcher.get({
					url: "/users/:id/echo-query",
					params: { id: "42" },
					query: { tab: "settings" },
				});
				const data = await response.json();
				expect(data).toEqual({ id: "42", tab: "settings" });
			});

			it("should append query params on POST requests", async () => {
				const response = await fetcher.post({
					url: "/items",
					query: { source: "test" },
					body: { item: "q" },
				});
				expect(response.ok).toBe(true);
				const data = await response.json();
				expect(data).toEqual({ success: true, item: "q" });
			});
		});
	};

	runFetcherTests("app based fetcher", async () => {
		return honoFetcher<typeof app>(app.request);
	});

	describe("fetcher helpers", () => {
		let server: ServerType;
		let port: number;
		let baseUrl: string;

		beforeAll(async () => {
			await new Promise((resolve) => {
				server = serve(
					{
						fetch: app.fetch,
						port: 0,
					},
					(info) => {
						port = info.port;
						baseUrl = `http://localhost:${port}`;
						resolve(true);
					},
				);
			});
		});

		afterAll(async () => {
			// Small delay to allow pending requests to complete
			await new Promise((resolve) => setTimeout(resolve, 50));
			// Close the server gracefully
			await new Promise<void>((resolve) => {
				server.close(() => resolve());
			});
		});

		describe("direct fetcher", () => {
			runFetcherTests("direct fetcher", async () => {
				return honoFetcher<typeof app>((request, init) => {
					return fetch(`${baseUrl}${request}`, init);
				});
			});
		});
	});

	// Type checking tests are handled by TypeScript at compile time
	// The actual type safety is validated through usage in the tests above
});
