import { fal } from "@fal-ai/client";
import type { NanoBananaProInput } from "@fal-ai/client/endpoints";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

// Configure fal with API key from environment
fal.config({
	credentials: process.env.FAL_API_KEY,
});

async function generateImage(
	prompt: string,
	outputPath: string,
	aspectRatio = "16:9",
	resolution = "1K",
	savePromptJson = true,
) {
	console.log(`Generating image with prompt: "${prompt}"`);
	console.log(`Aspect ratio: ${aspectRatio}`);
	console.log(`Resolution: ${resolution}`);
	console.log(`Output path: ${outputPath}`);

	const inputParams = {
		prompt,
		aspect_ratio: aspectRatio,
		resolution,
	};

	try {
		const result = await fal.subscribe("fal-ai/nano-banana-pro", {
			input: {
				prompt,
				aspect_ratio: aspectRatio as NanoBananaProInput["aspect_ratio"],
				resolution: resolution as NanoBananaProInput["resolution"],
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

			// Save input parameters as .prompt.json (only if requested)
			if (savePromptJson) {
				const promptJsonPath = outputPath.replace(/\.[^.]+$/, ".prompt.json");
				await writeFile(
					promptJsonPath,
					JSON.stringify(inputParams, null, 2),
					"utf-8",
				);
				console.log(`Prompt parameters saved to: ${promptJsonPath}`);
			}
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

// Check for --json flag
const jsonFlagIndex = args.indexOf("--json");
const hasJsonFlag = jsonFlagIndex !== -1;

if (hasJsonFlag) {
	// Usage with JSON input: --json <prompt-json-path> <output-path>
	if (args.length < 3) {
		console.error(
			"Usage: bun run gen-image --json <prompt-json-path> <output-path>",
		);
		console.error(
			"Example: bun run gen-image --json prompts/turtle.prompt.json output/turtle.png",
		);
		process.exit(1);
	}

	const promptJsonPath = args[jsonFlagIndex + 1];
	const outputPath = args[jsonFlagIndex + 2];

	// Read and parse the JSON file
	const promptJsonContent = await readFile(promptJsonPath, "utf-8");
	const promptData = JSON.parse(promptJsonContent);

	console.log(`\n📄 Using prompt from: ${promptJsonPath}\n`);

	// Generate image with JSON params, don't save a new prompt.json
	await generateImage(
		promptData.prompt,
		outputPath,
		promptData.aspect_ratio || "16:9",
		promptData.resolution || "1K",
		false, // Don't save prompt.json since we're using an existing one
	);
} else {
	// Original usage: <prompt> <output-path> [aspect-ratio] [resolution]
	if (args.length < 2) {
		console.error(
			"Usage: bun run gen-image <prompt> <output-path> [aspect-ratio] [resolution]",
		);
		console.error(
			"   OR: bun run gen-image --json <prompt-json-path> <output-path>",
		);
		console.error(
			'Example: bun run gen-image "a flying turtle" output/turtle.png',
		);
		console.error(
			'Example: bun run gen-image "a flying turtle" output/turtle.png "1:1" "2K"',
		);
		console.error(
			"Example: bun run gen-image --json prompts/turtle.prompt.json output/turtle.png",
		);
		console.error(
			"Available aspect ratios: 16:9 (default), 1:1, 4:3, 9:16, 21:9, etc.",
		);
		console.error("Available resolutions: 1K (default), 2K, 4K");
		process.exit(1);
	}

	const [prompt, outputPath, aspectRatio, resolution] = args;

	await generateImage(prompt, outputPath, aspectRatio, resolution, true);
}
