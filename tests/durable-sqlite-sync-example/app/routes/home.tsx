import { HomePage } from "../components/home/HomePage";

export function meta() {
	return [{ title: "WebSocket todo sync — Durable SQLite example" }];
}

export default function Home() {
	return <HomePage />;
}
