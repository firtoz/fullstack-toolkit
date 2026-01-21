/**
 * Common utilities and constants for ChatAgent E2E tests
 * 
 * This file contains shared functionality without any test hooks.
 * Import this in test files to access constants and utilities.
 */

export const BASE_URL = "ws://localhost:8787";
export const HTTP_BASE_URL = "http://localhost:8787";

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
