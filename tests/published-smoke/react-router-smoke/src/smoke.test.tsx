import { render } from "@testing-library/react";
import { StrictMode } from "react";
import * as RouterToolkit from "@firtoz/router-toolkit";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { EXPECTED_EXPORTS } from "../../shared/export-expectations.mjs";

describe("@firtoz/router-toolkit (React Router)", () => {
	it("exports expected runtime symbols", () => {
		const expected = EXPECTED_EXPORTS["@firtoz/router-toolkit"];
		expect(expected).toBeDefined();
		expect(typeof RouterToolkit.formAction).toBe("function");
		for (const name of expected) {
			expect(Reflect.has(RouterToolkit, name)).toBe(true);
			expect(Reflect.get(RouterToolkit, name)).toBeDefined();
		}
	});

	it("mounts ConcurrentSubmitterProvider under RouterProvider", () => {
		const router = createMemoryRouter([
			{
				path: "/",
				element: (
					<RouterToolkit.ConcurrentSubmitterProvider>
						<Outlet />
					</RouterToolkit.ConcurrentSubmitterProvider>
				),
				children: [
					{ index: true, element: <span data-testid="smoke">ok</span> },
				],
			},
		]);
		const { getByTestId } = render(
			<StrictMode>
				<RouterProvider router={router} />
			</StrictMode>,
		);
		expect(getByTestId("smoke").textContent).toBe("ok");
	});
});
