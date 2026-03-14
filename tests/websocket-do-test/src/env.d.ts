declare module "cloudflare:workers" {
	// Merge app bindings so env is typed in tests
	// eslint-disable-next-line @typescript-eslint/no-empty-object-type
	interface Env extends Record<string, unknown> {}
}
