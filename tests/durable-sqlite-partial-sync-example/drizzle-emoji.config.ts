import { defineConfig } from "drizzle-kit";

export default defineConfig({
	schema: "./src/emoji-grid-schema.ts",
	out: "./drizzle-emoji",
	dialect: "sqlite",
	driver: "durable-sqlite",
});
