import { fail, success } from "@firtoz/maybe-error";
import { data } from "react-router";

export const todoLoader = async ({ request }: { request: Request }) => {
	const headers = new Headers(request.headers);
	const locale = headers.get("accept-language")?.split(",")[0];

	if (!locale) {
		return data(fail("No locale found"), { status: 400 });
	}

	return success({ locale });
};
