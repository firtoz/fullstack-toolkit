import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fal } from "@fal-ai/client";

// Configure fal with API key from environment
fal.config({
	credentials: process.env.FAL_API_KEY,
});

async function generateImage(prompt: string, outputPath: string) {
	console.log(`Generating image with prompt: "${prompt}"`);
	console.log(`Output path: ${outputPath}`);

	try {
		const result = await fal.subscribe("fal-ai/nano-banana-pro", {
			input: {
				prompt,
			},
			logs: true,
			onQueueUpdate: (update) => {
				if (update.status === "IN_PROGRESS") {
					update.logs.map((log) => log.message).forEach(console.log);
				}
			},
		});

		console.log("Image generated successfully!");
		console.log("Request ID:", result.requestId);

		if (result.data?.images && result.data.images.length > 0) {
			const imageUrl = result.data.images[0].url;
			console.log("Downloading image from:", imageUrl);

			// Download the image
			const response = await fetch(imageUrl);
			if (!response.ok) {
				throw new Error(`Failed to download image: ${response.statusText}`);
			}

			const imageBuffer = await response.arrayBuffer();

			// Create directory if it doesn't exist
			const dir = dirname(outputPath);
			await mkdir(dir, { recursive: true });

			// Save the image
			await writeFile(outputPath, Buffer.from(imageBuffer));
			console.log(`Image saved to: ${outputPath}`);
		} else {
			throw new Error("No images generated");
		}
	} catch (error) {
		console.error("Error generating image:", error);
		process.exit(1);
	}
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 2) {
	console.error("Usage: bun run gen-image <prompt> <output-path>");
	console.error(
		'Example: bun run gen-image "a flying turtle" output/turtle.png',
	);
	process.exit(1);
}

const [prompt, outputPath] = args;

generateImage(prompt, outputPath);
