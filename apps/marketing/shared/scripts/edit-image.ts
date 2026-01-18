import { fal } from "@fal-ai/client";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

// Configure fal with API key from environment
fal.config({
	credentials: process.env.FAL_API_KEY,
});

async function editImage(
	inputPath: string,
	prompt: string,
	outputPath: string,
) {
	console.log(`Editing image: ${inputPath}`);
	console.log(`Prompt: "${prompt}"`);
	console.log(`Output path: ${outputPath}`);

	try {
		// Read the input image file
		const imageBuffer = await readFile(inputPath);
		const fileName = inputPath.split("/").pop() || "image.png";

		// Determine content type from file extension
		let contentType = "image/png";
		if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg")) {
			contentType = "image/jpeg";
		} else if (fileName.endsWith(".webp")) {
			contentType = "image/webp";
		}

		// Create a File object and upload it
		const file = new File([imageBuffer], fileName, { type: contentType });
		console.log("Uploading image to fal.ai...");
		const imageUrl = await fal.storage.upload(file);
		console.log("Image uploaded:", imageUrl);

		// Edit the image
		console.log("Editing image...");
		const result = await fal.subscribe("fal-ai/nano-banana-pro/edit", {
			input: {
				prompt,
				image_urls: [imageUrl],
			},
			logs: true,
			onQueueUpdate: (update) => {
				if (update.status === "IN_PROGRESS") {
					update.logs.map((log) => log.message).forEach(console.log);
				}
			},
		});

		console.log("Image edited successfully!");
		console.log("Request ID:", result.requestId);

		if (result.data?.images && result.data.images.length > 0) {
			const editedImageUrl = result.data.images[0].url;
			console.log("Downloading edited image from:", editedImageUrl);

			// Download the edited image
			const response = await fetch(editedImageUrl);
			if (!response.ok) {
				throw new Error(`Failed to download image: ${response.statusText}`);
			}

			const editedImageBuffer = await response.arrayBuffer();

			// Create directory if it doesn't exist
			const dir = dirname(outputPath);
			await mkdir(dir, { recursive: true });

			// Save the edited image
			await writeFile(outputPath, Buffer.from(editedImageBuffer));
			console.log(`Edited image saved to: ${outputPath}`);
		} else {
			throw new Error("No images generated");
		}
	} catch (error) {
		console.error("Error editing image:", error);
		process.exit(1);
	}
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 3) {
	console.error(
		"Usage: bun run edit-image <input-image-path> <prompt> <output-path>",
	);
	console.error(
		'Example: bun run edit-image input.png "make it blue" output.png',
	);
	process.exit(1);
}

const [inputPath, prompt, outputPath] = args;

editImage(inputPath, prompt, outputPath);
