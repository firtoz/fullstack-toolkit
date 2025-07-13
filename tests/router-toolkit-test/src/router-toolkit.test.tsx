import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import { describe, expect, it } from "vitest";

// Test imports
describe("Router Toolkit Imports", () => {
	it("should be able to import router-toolkit hooks", async () => {
		const { useDynamicFetcher, useDynamicSubmitter } = await import(
			"@firtoz/router-toolkit"
		);

		expect(useDynamicFetcher).toBeDefined();
		expect(useDynamicSubmitter).toBeDefined();
		expect(typeof useDynamicFetcher).toBe("function");
		expect(typeof useDynamicSubmitter).toBe("function");
	});

	it("should be able to import maybe-error utilities", async () => {
		const { success, fail } = await import("@firtoz/maybe-error");

		expect(success).toBeDefined();
		expect(fail).toBeDefined();
		expect(typeof success).toBe("function");
		expect(typeof fail).toBe("function");

		// Test basic functionality
		const successResult = success(42);
		expect(successResult.success).toBe(true);
		expect(successResult.result).toBe(42);

		const errorResult = fail("test error");
		expect(errorResult.success).toBe(false);
		expect(errorResult.error).toBe("test error");
	});
});

// Test basic React Router setup
describe("React Router Setup", () => {
	it("should render a basic router component", () => {
		const TestComponent = () => (
			<BrowserRouter>
				<div>Router Test</div>
			</BrowserRouter>
		);

		render(<TestComponent />);
		expect(screen.getByText("Router Test")).toBeInTheDocument();
	});
});
