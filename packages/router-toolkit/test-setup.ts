// Test setup for Bun test runner
// This file is automatically loaded before tests run
import { JSDOM } from "jsdom";

// Set up JSDOM
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
	url: "http://localhost:3000",
	pretendToBeVisual: true,
});

// Set globals
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window
	.document as unknown as typeof globalThis.document;
globalThis.navigator = dom.window
	.navigator as unknown as typeof globalThis.navigator;
globalThis.HTMLElement = dom.window
	.HTMLElement as unknown as typeof globalThis.HTMLElement;
globalThis.Element = dom.window.Element as unknown as typeof globalThis.Element;
