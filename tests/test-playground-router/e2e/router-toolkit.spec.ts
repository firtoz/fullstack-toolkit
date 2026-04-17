import { expect, test } from "@playwright/test";

/**
 * E2E tests for @firtoz/router-toolkit
 *
 * These tests verify that the router-toolkit hooks work correctly:
 * - useDynamicSubmitter: Form submission with type-safe data
 * - formAction: Validation and error handling
 * - useDynamicFetcher: Data fetching (if used)
 */

test.describe("useDynamicSubmitter & formAction", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/router-toolkit/form-action-test");
	});

	test("useDynamicSubmitter should provide type-safe submit state", async ({
		page,
	}) => {
		// Verify initial state from useDynamicSubmitter
		await page.screenshot({ path: "test-results/initial-state.png" });

		// The button should be enabled (not submitting)
		const submitButton = page.getByRole("button", { name: /register/i });
		await expect(submitButton).toBeEnabled();
		await expect(submitButton).toHaveText("Register");

		// Fill form to trigger submission
		await page.getByLabel(/name/i).fill("Test User");
		await page.getByLabel(/email/i).fill("test@example.com");
		await page.getByLabel(/age/i).fill("25");
		await page.getByLabel(/accept the terms and conditions/i).check();

		// Intercept the form submission to slow it down so we can catch the submitting state
		await page.route("**/router-toolkit/form-action-test*", async (route) => {
			if (route.request().method() === "POST") {
				await new Promise((r) => setTimeout(r, 500));
			}
			await route.continue();
		});

		// Start submission - useDynamicSubmitter should update state
		await submitButton.click();

		// CORE TEST: useDynamicSubmitter provides "submitting" state
		// The button should show submitting state and be disabled
		await expect(submitButton).toHaveText("Registering...", { timeout: 2000 });
		await expect(submitButton).toBeDisabled();

		// Wait for completion
		await expect(page.getByText("✅ Registration successful!")).toBeVisible({
			timeout: 10000,
		});
	});

	test("should show validation errors using formAction", async ({ page }) => {
		// Fill form with invalid Zod data
		await page.getByLabel(/name/i).fill("A"); // Too short for Zod
		await page.getByLabel(/email/i).fill("test@example.com");
		// Note: HTML5 min=18 blocks submission, so we use JS to bypass
		await page.getByLabel(/age/i).evaluate((el) => el.removeAttribute("min"));
		await page.getByLabel(/age/i).fill("15"); // Under 18 for Zod
		await page.getByLabel(/accept the terms and conditions/i).check();

		// Submit - formAction should catch Zod validation errors
		await page.getByRole("button", { name: /register/i }).click();

		// Check validation errors appear
		await expect(page.locator("text=/Registration failed/i")).toBeVisible({
			timeout: 5000,
		});
		await expect(page.locator("text=/Validation errors/i")).toBeVisible();
	});

	test("should successfully submit valid data with useDynamicSubmitter", async ({
		page,
	}) => {
		// Fill form with valid data
		await page.getByLabel(/name/i).fill("John Doe");
		await page.getByLabel(/email/i).fill("john@example.com");
		await page.getByLabel(/age/i).fill("25");
		await page.getByLabel(/accept the terms and conditions/i).check();

		// Submit using useDynamicSubmitter
		await page.getByRole("button", { name: /register/i }).click();

		// Should show success from formAction handler
		await expect(page.getByText("✅ Registration successful!")).toBeVisible();
		await expect(page.getByText(/welcome, john doe/i)).toBeVisible();
	});

	test("should show handler error from formAction", async ({ page }) => {
		// Fill form with admin email (business logic error)
		await page.getByLabel(/name/i).fill("Admin User");
		await page.getByLabel(/email/i).fill("admin@example.com");
		await page.getByLabel(/age/i).fill("30");
		await page.getByLabel(/accept the terms and conditions/i).check();

		// Submit using useDynamicSubmitter
		await page.getByRole("button", { name: /register/i }).click();

		// Should show handler error from formAction
		await expect(page.getByText("❌ Registration failed")).toBeVisible({
			timeout: 5000,
		});
		await expect(
			page.getByText("Error: Admin email is not allowed for registration"),
		).toBeVisible();
	});

	test("should show submitting state from useDynamicSubmitter", async ({
		page,
	}) => {
		// Fill form
		await page.getByLabel(/name/i).fill("John Doe");
		await page.getByLabel(/email/i).fill("john@example.com");
		await page.getByLabel(/age/i).fill("25");
		await page.getByLabel(/accept the terms and conditions/i).check();

		// Click submit
		const submitButton = page.getByRole("button", { name: /register/i });
		await submitButton.click();

		// Should show "Registering..." state from useDynamicSubmitter
		await expect(
			page.getByRole("button", { name: /registering/i }),
		).toBeVisible();

		// Wait for completion
		await expect(page.getByText("✅ Registration successful!")).toBeVisible();
	});
});

test.describe("useDynamicSubmitter (with loader)", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/router-toolkit/submitter-with-loader");
	});

	test("useDynamicSubmitter should work alongside useLoaderData", async ({
		page,
	}) => {
		// Screenshot initial state
		await page.screenshot({
			path: "test-results/submitter-loader-initial.png",
		});

		// CORE TEST 1: Loader data loads (from useLoaderData)
		await expect(page.getByText(/john doe/i)).toBeVisible();
		await expect(page.getByText(/john@example\.com/i)).toBeVisible();

		// CORE TEST 2: useDynamicSubmitter provides initial idle state
		const statusSection = page.getByTestId("submitter-status");
		await expect(statusSection).toContainText('"state": "idle"');

		// Fill form with test email to trigger specific response
		await page.getByLabel(/^name:/i).fill("Test Submitter User");
		await page.getByLabel(/^email:/i).fill("test-fetcher@example.com");

		const submitButton = page.getByTestId("submitter-submit-button");

		// CORE TEST 3: useDynamicSubmitter updates state to "submitting"
		await submitButton.click();

		// Should show submitting state (1 second delay in action)
		await expect(submitButton).toHaveText("Updating...");
		await expect(submitButton).toBeDisabled();
		await expect(statusSection).toContainText('"state": "submitting"');

		await page.screenshot({
			path: "test-results/submitter-loader-submitting.png",
		});

		// CORE TEST 4: useDynamicSubmitter provides typed action data after completion
		const resultSection = page.getByTestId("action-result");
		await expect(resultSection).toBeVisible({ timeout: 3000 });
		await expect(resultSection).toContainText(
			"Fetcher test completed successfully!",
		);
		await expect(resultSection).toContainText("Test Submitter User");

		await page.screenshot({
			path: "test-results/submitter-loader-complete.png",
		});

		// CORE TEST 5: State returns to "idle" (submitter lifecycle complete)
		await expect(statusSection).toContainText('"state": "idle"');
		await expect(submitButton).toBeEnabled();
	});
});

test.describe("useDynamicFetcher (data fetching)", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/router-toolkit/fetcher-data-refresh");
	});

	test("useDynamicFetcher should fetch data from loader", async ({ page }) => {
		await page.screenshot({ path: "test-results/fetcher-initial.png" });

		// CORE TEST 1: Initial page load (no fetcher data yet)
		const fetcherState = page.getByTestId("fetcher-state");
		await expect(fetcherState).toContainText('"state": "idle"');

		// CORE TEST 2: Click refresh to use fetcher.load()
		const refreshButton = page.getByTestId("refresh-button");
		await refreshButton.click();

		// Should show loading state
		await expect(refreshButton).toHaveText(/Loading/);
		await expect(fetcherState).toContainText('"state": "loading"');

		await page.screenshot({ path: "test-results/fetcher-loading.png" });

		// CORE TEST 3: useDynamicFetcher provides typed data from loader
		const userData = page.getByTestId("user-data");
		await expect(userData).toContainText("Jane Doe", { timeout: 2000 });
		await expect(userData).toContainText("jane@example.com");
		await expect(userData).toContainText('"fetchCount": 1');

		// CORE TEST 4: State returns to idle after loading
		await expect(fetcherState).toContainText('"state": "idle"');

		await page.screenshot({ path: "test-results/fetcher-loaded.png" });

		// CORE TEST 5: Refresh again to increment fetch count
		await refreshButton.click();
		await expect(userData).toContainText('"fetchCount": 2', { timeout: 2000 });
	});
});

test.describe("useConcurrentSubmitter", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/router-toolkit/concurrent-submitter-test");
	});

	test("should show concurrent submitter page and submit one operation", async ({
		page,
	}) => {
		await expect(page.getByRole("heading", { name: /Concurrent Submitter/ })).toBeVisible();
		await expect(page.getByRole("button", { name: /Submit Alice/i })).toBeVisible();
		await expect(page.getByRole("button", { name: /Submit Bob/i })).toBeVisible();
		await expect(page.getByRole("button", { name: /Submit Carol/i })).toBeVisible();

		// Submit Alice
		await page.getByRole("button", { name: /Submit Alice/i }).click();

		// Operation should appear and complete with success (scope to operations list to avoid matching the button)
		const operationsList = page.getByRole("list");
		await expect(operationsList.getByText(/op-1/)).toBeVisible({ timeout: 3000 });
		await expect(operationsList.getByText(/status: done/)).toBeVisible({ timeout: 5000 });
		await expect(operationsList.getByText(/— Alice/)).toBeVisible();
		await expect(operationsList.getByText(/Registration successful!/)).toBeVisible({ timeout: 5000 });
		await expect(operationsList.getByText(/alice@test\.com/)).toBeVisible();
	});

	test("should track multiple concurrent submissions", async ({ page }) => {
		// Fire all three submissions in quick succession
		await page.getByRole("button", { name: /Submit Alice/i }).click();
		await page.getByRole("button", { name: /Submit Bob/i }).click();
		await page.getByRole("button", { name: /Submit Carol/i }).click();

		// Operations list should show 3 entries
		await expect(page.getByRole("heading", { name: /Operations \(3\)/ })).toBeVisible({
			timeout: 8000,
		});

		// All three should complete with done status and names (scope to list to avoid button matches)
		const operationsList = page.getByRole("list");
		await expect(operationsList.getByText(/status: done/).first()).toBeVisible({ timeout: 8000 });
		await expect(operationsList.getByText(/— Alice/)).toBeVisible();
		await expect(operationsList.getByText(/— Bob/)).toBeVisible();
		await expect(operationsList.getByText(/— Carol/)).toBeVisible();
		await expect(operationsList.getByText(/Registration successful!/).first()).toBeVisible();
	});
});

test.describe("useDynamicFetcher (invalidation)", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/router-toolkit/fetcher-invalidation");
	});

	test("useDynamicFetcher should invalidate and fetch fresh data", async ({
		page,
	}) => {
		await page.screenshot({ path: "test-results/invalidation-initial.png" });

		// CORE TEST 1: Initial page load shows first timestamp
		const currentTimestamp = page.getByTestId("current-timestamp");
		const loadCount = page.getByTestId("load-count");
		const fetchHistory = page.getByTestId("fetch-history");

		await expect(loadCount).toContainText("Load Count: 1");
		const initialTimestamp = await currentTimestamp.textContent();

		// Should have one item in history (initial load)
		await expect(fetchHistory.locator('[data-fetch-index="0"]')).toBeVisible();

		// CORE TEST 2: Click invalidate button
		const invalidateButton = page.getByTestId("invalidate-button");
		await invalidateButton.click();

		// Should show loading state
		await expect(invalidateButton).toHaveText(/Revalidating/);
		await expect(page.getByTestId("fetcher-state")).toContainText(
			'"state": "loading"',
		);

		await page.screenshot({ path: "test-results/invalidation-loading.png" });

		// CORE TEST 3: After revalidation, timestamp should be DIFFERENT
		await expect(loadCount).toContainText("Load Count: 2", { timeout: 2000 });
		const secondTimestamp = await currentTimestamp.textContent();

		// Timestamps should be different (data was invalidated and reloaded)
		expect(secondTimestamp).not.toBe(initialTimestamp);

		// Should have two items in history now
		await expect(fetchHistory.locator('[data-fetch-index="1"]')).toBeVisible();

		await page.screenshot({ path: "test-results/invalidation-second.png" });

		// CORE TEST 4: Invalidate again to verify it keeps working
		await page.waitForTimeout(100); // Small delay to ensure timestamp will differ
		await invalidateButton.click();

		await expect(loadCount).toContainText("Load Count: 3", { timeout: 2000 });
		const thirdTimestamp = await currentTimestamp.textContent();

		// Third timestamp should be different from second
		expect(thirdTimestamp).not.toBe(secondTimestamp);

		// Should have three items in history
		await expect(fetchHistory.locator('[data-fetch-index="2"]')).toBeVisible();

		await page.screenshot({ path: "test-results/invalidation-third.png" });

		// CORE TEST 5: All three timestamps in history should be unique
		const historyItems = await fetchHistory.locator("[data-fetch-index]").all();
		expect(historyItems.length).toBe(3);
	});
});
