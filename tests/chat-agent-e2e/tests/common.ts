/**
 * Common utilities and constants for ChatAgent E2E tests
 * 
 * This file contains shared functionality without any test hooks.
 * Import this in test files to access constants and utilities.
 */

const CHAT_AGENT_E2E_PORT = process.env.CHAT_AGENT_E2E_PORT ?? "8791";

export const BASE_URL = `ws://localhost:${CHAT_AGENT_E2E_PORT}`;
export const HTTP_BASE_URL = `http://localhost:${CHAT_AGENT_E2E_PORT}`;

/**
 * Wait for the wrangler dev server to be ready
 */
export async function waitForServer(maxAttempts = 60): Promise<boolean> {
	for (let i = 0; i < maxAttempts; i++) {
		try {
			const response = await fetch(HTTP_BASE_URL);
			if (response.ok) {
				return true;
			}
		} catch {
			if (i % 10 === 0 && i > 0) {
				console.log(`Waiting for server... (${i}/${maxAttempts})`);
			}
			await new Promise((resolve) => setTimeout(resolve, 500));
		}
	}
	return false;
}
