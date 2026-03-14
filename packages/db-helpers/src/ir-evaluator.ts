import type { IR } from "@tanstack/db";

/**
 * Evaluates a TanStack DB IR expression against a plain object item.
 * @internal Exported for testing and reuse by collection backends
 */
export function evaluateExpression(
	expression: IR.BasicExpression,
	item: Record<string, unknown>,
): boolean {
	switch (expression.type) {
		case "ref": {
			const propRef = expression;
			const columnName = propRef.path[propRef.path.length - 1];
			return item[columnName as string] !== undefined;
		}
		case "val": {
			const value = expression;
			return !!value.value;
		}
		case "func": {
			const func = expression;

			switch (func.name) {
				case "eq": {
					const left = getExpressionValue(func.args[0], item);
					const right = getExpressionValue(func.args[1], item);
					return left === right;
				}
				case "ne": {
					const left = getExpressionValue(func.args[0], item);
					const right = getExpressionValue(func.args[1], item);
					return left !== right;
				}
				case "gt": {
					const left = getExpressionValue(func.args[0], item);
					const right = getExpressionValue(func.args[1], item);
					return left > right;
				}
				case "gte": {
					const left = getExpressionValue(func.args[0], item);
					const right = getExpressionValue(func.args[1], item);
					return left >= right;
				}
				case "lt": {
					const left = getExpressionValue(func.args[0], item);
					const right = getExpressionValue(func.args[1], item);
					return left < right;
				}
				case "lte": {
					const left = getExpressionValue(func.args[0], item);
					const right = getExpressionValue(func.args[1], item);
					return left <= right;
				}
				case "and": {
					return func.args.every((arg) => evaluateExpression(arg, item));
				}
				case "or": {
					return func.args.some((arg) => evaluateExpression(arg, item));
				}
				case "not": {
					return !evaluateExpression(func.args[0], item);
				}
				case "isNull": {
					const value = getExpressionValue(func.args[0], item);
					return value === null || value === undefined;
				}
				case "isNotNull": {
					const value = getExpressionValue(func.args[0], item);
					return value !== null && value !== undefined;
				}
				case "like": {
					const left = String(getExpressionValue(func.args[0], item));
					const right = String(getExpressionValue(func.args[1], item));
					const pattern = right.replace(/%/g, ".*").replace(/_/g, ".");
					return new RegExp(`^${pattern}$`).test(left);
				}
				case "ilike": {
					const left = String(getExpressionValue(func.args[0], item));
					const right = String(getExpressionValue(func.args[1], item));
					const pattern = right.replace(/%/g, ".*").replace(/_/g, ".");
					return new RegExp(`^${pattern}$`, "i").test(left);
				}
				case "in": {
					const left = getExpressionValue(func.args[0], item);
					const right = getExpressionValue(func.args[1], item);
					return Array.isArray(right) && right.includes(left);
				}
				case "isUndefined": {
					const value = getExpressionValue(func.args[0], item);
					return value === null || value === undefined;
				}
				default:
					throw new Error(`Unsupported function: ${func.name}`);
			}
		}
		default: {
			const _ex: never = expression;
			void _ex;
			throw new Error(
				`Unsupported expression type: ${(expression as { type: string }).type}`,
			);
		}
	}
}

/**
 * Gets the value from an IR expression by resolving refs and vals.
 * @internal Exported for testing and reuse by collection backends
 */
export function getExpressionValue(
	expression: IR.BasicExpression,
	item: Record<string, unknown>,
	// biome-ignore lint/suspicious/noExplicitAny: We need any here for dynamic values
): any {
	switch (expression.type) {
		case "ref": {
			const propRef = expression;
			const columnName = propRef.path[propRef.path.length - 1];
			return item[columnName as string];
		}
		case "val": {
			const value = expression;
			return value.value;
		}
		case "func":
			throw new Error("Cannot get value from func expression");
		default: {
			const _ex: never = expression;
			void _ex;
			throw new Error(
				`Cannot get value from expression type: ${(expression as { type: string }).type}`,
			);
		}
	}
}
