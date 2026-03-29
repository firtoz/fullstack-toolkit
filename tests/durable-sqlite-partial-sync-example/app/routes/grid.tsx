import { EmojiGridPage } from "../components/grid/EmojiGridPage";

export function meta() {
	return [{ title: "Emoji grid partial sync" }];
}

export default function GridRoute() {
	return <EmojiGridPage />;
}
