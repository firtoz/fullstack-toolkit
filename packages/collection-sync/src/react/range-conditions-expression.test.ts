import { describe, expect, it } from "bun:test";
import { buildRangeConditionsAndExpression } from "./range-conditions-expression";

describe("buildRangeConditionsAndExpression", () => {
	it("throws on empty conditions", () => {
		expect(() => buildRangeConditionsAndExpression({ x: 1 }, [])).toThrow(
			"non-empty",
		);
	});
});
