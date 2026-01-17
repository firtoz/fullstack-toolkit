/**
 * Process video pipeline - generates per-scene audio, transcribes, validates markers,
 * and generates timing.ts
 *
 * Usage: bun run process-video.ts <video-id> [voice] [preset] [speed] [--force]
 *
 * Environment: ELEVENLABS_API_KEY (from .env file - bun loads automatically)
 *
 * Features:
 *   - Skips scenes that are already processed and valid
 *   - Use --force to regenerate all scenes
 *
 * Example:
 *   bun run process-video.ts 2026-01-dx-focus liam energetic 1.1
 *   bun run process-video.ts 2026-01-dx-focus --force
 */

import { createHash } from "node:crypto";
import { ElevenLabsClient } from "elevenlabs";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { validateMarkers, resolveMarkers } from "./marker-resolver";
import type {
	AudioGenerationOptions,
	ProcessedScene,
	Scene,
	SceneTimingInfo,
	TranscriptionResult,
	VideoConfig,
} from "../lib/video-types";

// Voice IDs from ElevenLabs - curated for tech/marketing content
const VOICES: Record<string, string> = {
	// Energetic / Marketing-friendly
	liam: "TX3LPaxmHKxFdv7VOQHJ", // Energetic young American - BEST for tech demos
	chris: "iP95p4xoKVk53GoZ742B", // American casual, conversational

	// Professional narrators
	adam: "pNInz6obpgDQGcFmaJgB", // Deep American, authoritative
	brian: "nPczCjzI2devNBz1zQrb", // American narrator, warm
	daniel: "onwK4e9ZLuTAKqWW03F9", // British deep, authoritative

	// British voices
	alice: "Xb7hH8MSUJpSbSDYk0k2", // British female, confident
	george: "JBFqnCBsd6RMkjVDRZzb", // British warm narrator
	charlie: "IKne3meq5aSn9XLyUdCD", // Australian casual

	// Other good options
	antoni: "ErXwobaYiN019PkySvjV", // Young American, friendly explainer
	josh: "TxGEqnHWrfWFTfGW9XjX", // Energetic, youthful
	arnold: "VR6AewLTigWG4xSOukaG", // Confident, authoritative
};

const VOICE_PRESETS = {
	professional: { stability: 0.5, style: 0.3 },
	energetic: { stability: 0.2, style: 0.8 },
	calm: { stability: 0.7, style: 0.2 },
} as const;

const DEFAULT_VOICE = "liam";
const DEFAULT_PRESET = "energetic";
const DEFAULT_SPEED = 1.0;
const MAX_RETRIES = 3;

// Paths
const __dirname = dirname(fileURLToPath(import.meta.url));
const VIDEOS_DIR = join(__dirname, "..", "..", "videos");
const REMOTION_PUBLIC = join(__dirname, "..", "..", "remotion-video", "public");

/**
 * Generate audio for a single narration using ElevenLabs
 */
async function generateAudio(
	client: ElevenLabsClient,
	narration: string,
	options: AudioGenerationOptions,
): Promise<Buffer> {
	const voiceName = options.voice ?? DEFAULT_VOICE;
	const preset = options.preset ?? DEFAULT_PRESET;
	const speed = options.speed ?? DEFAULT_SPEED;

	const voiceId = VOICES[voiceName];
	if (!voiceId) {
		throw new Error(`Unknown voice: ${voiceName}`);
	}

	const settings = VOICE_PRESETS[preset];

	const audioStream = await client.textToSpeech.convert(voiceId, {
		text: narration,
		model_id: "eleven_multilingual_v2",
		voice_settings: {
			stability: settings.stability,
			similarity_boost: 0.8,
			style: settings.style,
			use_speaker_boost: true,
			speed,
		},
	});

	// Convert stream to buffer
	const chunks: Buffer[] = [];
	const readable = Readable.from(audioStream);

	return new Promise((resolve, reject) => {
		readable.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
		readable.on("end", () => resolve(Buffer.concat(chunks)));
		readable.on("error", reject);
	});
}

/**
 * Transcribe audio using ElevenLabs Speech-to-Text
 */
async function transcribeAudio(
	client: ElevenLabsClient,
	audioPath: string,
): Promise<TranscriptionResult> {
	const audioBuffer = readFileSync(audioPath);
	const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" });

	const result = await client.speechToText.convert({
		model_id: "scribe_v1",
		file: audioBlob,
		language_code: "en",
		timestamps_granularity: "word",
	});

	return result as TranscriptionResult;
}

/**
 * Get audio duration from transcription (last word end time)
 */
function getAudioDuration(transcription: TranscriptionResult): number {
	const words = transcription.words;
	if (words.length === 0) return 0;

	let maxEnd = 0;
	for (const word of words) {
		if (word.end > maxEnd) {
			maxEnd = word.end;
		}
	}
	return maxEnd;
}

/**
 * Compute a hash of scene input (narration + markers) for cache invalidation
 */
function computeSceneHash(scene: Scene): string {
	const input = JSON.stringify({
		narration: scene.narration,
		markers: scene.markers,
	});
	return createHash("sha256").update(input).digest("hex").substring(0, 16);
}

/**
 * Cache manifest structure - stored in videoDir/cache-manifest.json
 */
interface CacheManifest {
	scenes: Record<string, { inputHash: string; generatedAt: string }>;
}

/**
 * Load cache manifest from disk
 */
function loadCacheManifest(videoDir: string): CacheManifest {
	const manifestPath = join(videoDir, "cache-manifest.json");
	if (!existsSync(manifestPath)) {
		return { scenes: {} };
	}
	try {
		return JSON.parse(readFileSync(manifestPath, "utf-8"));
	} catch {
		return { scenes: {} };
	}
}

/**
 * Save cache manifest to disk
 */
function saveCacheManifest(videoDir: string, manifest: CacheManifest): void {
	const manifestPath = join(videoDir, "cache-manifest.json");
	writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

/**
 * Check if a scene is already processed and valid
 * Returns the processed scene data if valid, null otherwise
 */
function checkExistingScene(
	scene: Scene,
	videoDir: string,
	fps: number,
	cacheManifest: CacheManifest,
): ProcessedScene | null {
	const audioPath = join(videoDir, "audio", `${scene.id}.mp3`);
	const transcriptionPath = join(
		videoDir,
		"transcriptions",
		`${scene.id}.json`,
	);

	// Check if files exist
	if (!existsSync(audioPath) || !existsSync(transcriptionPath)) {
		return null;
	}

	// Check if input hash matches (script hasn't changed)
	const currentHash = computeSceneHash(scene);
	const cachedInfo = cacheManifest.scenes[scene.id];
	if (!cachedInfo || cachedInfo.inputHash !== currentHash) {
		return null; // Script changed, need to regenerate
	}

	try {
		// Load and parse transcription
		const transcriptionData = readFileSync(transcriptionPath, "utf-8");
		const transcription: TranscriptionResult = JSON.parse(transcriptionData);

		// Validate markers against transcription
		const validation = validateMarkers(scene.markers, transcription.words);
		if (!validation.valid) {
			return null;
		}

		// Resolve markers and get duration
		const resolvedMarkers = resolveMarkers(
			scene.markers,
			transcription.words,
			fps,
		);
		const audioDuration = getAudioDuration(transcription);
		const durationFrames = Math.round(audioDuration * fps);

		return {
			id: scene.id,
			audioFile: `${scene.id}.mp3`,
			audioDuration,
			durationFrames,
			transcription: transcription.words,
			markers: resolvedMarkers,
		};
	} catch {
		return null;
	}
}

/**
 * Save a failed attempt for manual review
 */
async function saveAttempt(
	videoDir: string,
	sceneId: string,
	attempt: number,
	audioBuffer: Buffer,
	transcription: TranscriptionResult,
	errors: string[],
): Promise<void> {
	const attemptsDir = join(
		videoDir,
		"attempts",
		`${sceneId}-attempt-${attempt}`,
	);
	mkdirSync(attemptsDir, { recursive: true });

	writeFileSync(join(attemptsDir, "audio.mp3"), audioBuffer);
	writeFileSync(
		join(attemptsDir, "transcription.json"),
		JSON.stringify(transcription, null, 2),
	);
	writeFileSync(join(attemptsDir, "errors.txt"), errors.join("\n"));

	console.log(`   📁 Saved attempt ${attempt} to: ${attemptsDir}`);
}

/**
 * Process a single scene - generate audio, transcribe, validate, resolve markers
 */
async function processScene(
	client: ElevenLabsClient,
	scene: Scene,
	videoDir: string,
	fps: number,
	options: AudioGenerationOptions,
	attempt = 1,
): Promise<ProcessedScene> {
	console.log(
		`\n🎬 Processing scene: ${scene.id} (attempt ${attempt}/${MAX_RETRIES})`,
	);
	console.log(`   📝 Narration: "${scene.narration.substring(0, 60)}..."`);

	// 1. Generate audio
	console.log("   🎙️ Generating audio...");
	const audioBuffer = await generateAudio(client, scene.narration, options);

	// 2. Save audio
	const audioDir = join(videoDir, "audio");
	mkdirSync(audioDir, { recursive: true });
	const audioPath = join(audioDir, `${scene.id}.mp3`);
	writeFileSync(audioPath, audioBuffer);
	console.log(`   💾 Saved: ${audioPath}`);

	// 3. Transcribe
	console.log("   📝 Transcribing...");
	const transcription = await transcribeAudio(client, audioPath);
	console.log(
		`   🔤 Words detected: ${transcription.words.filter((w) => w.type === "word").length}`,
	);

	// 4. Save transcription
	const transcriptionsDir = join(videoDir, "transcriptions");
	mkdirSync(transcriptionsDir, { recursive: true });
	writeFileSync(
		join(transcriptionsDir, `${scene.id}.json`),
		JSON.stringify(transcription, null, 2),
	);

	// 5. Validate markers
	const validation = validateMarkers(scene.markers, transcription.words);

	if (!validation.valid) {
		console.log(`   ⚠️ Validation failed:`);
		for (const error of validation.errors) {
			console.log(`      - ${error}`);
		}

		// Save failed attempt
		await saveAttempt(
			videoDir,
			scene.id,
			attempt,
			audioBuffer,
			transcription,
			validation.errors,
		);

		if (attempt < MAX_RETRIES) {
			console.log(`   🔄 Retrying...`);
			return processScene(client, scene, videoDir, fps, options, attempt + 1);
		}

		throw new Error(
			`Scene "${scene.id}" failed after ${MAX_RETRIES} attempts:\n${validation.errors.join("\n")}`,
		);
	}

	console.log(`   ✅ Validation passed`);

	// 6. Resolve markers
	const resolvedMarkers = resolveMarkers(
		scene.markers,
		transcription.words,
		fps,
	);
	const audioDuration = getAudioDuration(transcription);
	const durationFrames = Math.round(audioDuration * fps);

	console.log(
		`   ⏱️ Duration: ${audioDuration.toFixed(2)}s (${durationFrames} frames)`,
	);

	return {
		id: scene.id,
		audioFile: `${scene.id}.mp3`,
		audioDuration,
		durationFrames,
		transcription: transcription.words,
		markers: resolvedMarkers,
	};
}

/**
 * Generate timing.ts file from processed scenes
 */
function generateTimingFile(
	processedScenes: ProcessedScene[],
	fps: number,
	videoDir: string,
): void {
	const sceneTimings: SceneTimingInfo[] = processedScenes.map((scene) => ({
		id: scene.id,
		audioFile: scene.audioFile,
		audioDuration: Math.round(scene.audioDuration * 1000) / 1000,
		durationFrames: scene.durationFrames,
		markers: scene.markers,
	}));

	const timingCode = `/**
 * Auto-generated timing data
 * Generated: ${new Date().toISOString()}
 *
 * DO NOT EDIT MANUALLY - regenerate with:
 *   bun run process-video.ts <video-id>
 */

import type { ResolvedMarker, SceneTimingInfo } from "../../shared/lib/video-types";

export const FPS = ${fps};

export const sceneTimings: SceneTimingInfo[] = ${JSON.stringify(sceneTimings, null, "\t")};
`;

	const timingPath = join(videoDir, "timing.ts");
	writeFileSync(timingPath, timingCode);
	console.log(`\n✅ Generated timing file: ${timingPath}`);
}

/**
 * Copy audio files to remotion public folder
 */
function copyAudioToPublic(videoId: string, videoDir: string): void {
	const publicAudioDir = join(REMOTION_PUBLIC, videoId, "audio");
	mkdirSync(publicAudioDir, { recursive: true });

	const sourceAudioDir = join(videoDir, "audio");
	const audioFiles = readdirSync(sourceAudioDir).filter((f) =>
		f.endsWith(".mp3"),
	);

	for (const file of audioFiles) {
		const src = join(sourceAudioDir, file);
		const dest = join(publicAudioDir, file);
		writeFileSync(dest, readFileSync(src));
		console.log(`   📋 Copied: ${dest}`);
	}
}

function showUsage(): void {
	console.error("Usage:");
	console.error(
		"  bun run process-video.ts <video-id> [voice] [preset] [speed] [--force]",
	);
	console.error("\nArguments:");
	console.error("  video-id  - The video folder name (e.g., 2026-01-dx-focus)");
	console.error("  voice     - Voice name (default: liam)");
	console.error(
		"  preset    - Voice preset: professional, energetic, calm (default: energetic)",
	);
	console.error("  speed     - Speech speed 0.5-2.0 (default: 1.0)");
	console.error(
		"  --force   - Force regeneration of all scenes (skip cache check)",
	);
	console.error("\nEnvironment:");
	console.error("  ELEVENLABS_API_KEY - Required. Can be set in .env file.");
	console.error("\nAvailable voices:");
	for (const name of Object.keys(VOICES)) {
		console.error(`  - ${name}${name === DEFAULT_VOICE ? " (default)" : ""}`);
	}
	console.error("\nExample:");
	console.error(
		"  bun run process-video.ts 2026-01-dx-focus liam energetic 1.1",
	);
	console.error("  bun run process-video.ts 2026-01-dx-focus --force");
}

async function main() {
	const apiKey = process.env.ELEVENLABS_API_KEY;

	if (!apiKey) {
		console.error(
			"❌ Error: ELEVENLABS_API_KEY environment variable is required\n",
		);
		console.error("Set it in a .env file or export it in your shell.\n");
		showUsage();
		process.exit(1);
	}

	const videoId = process.argv[2];
	if (!videoId) {
		console.error("❌ Error: Video ID is required\n");
		showUsage();
		process.exit(1);
	}

	// Check video folder exists
	const videoDir = join(VIDEOS_DIR, videoId);
	if (!existsSync(videoDir)) {
		console.error(`❌ Error: Video folder not found: ${videoDir}`);
		console.error("\nAvailable videos:");
		for (const dir of readdirSync(VIDEOS_DIR)) {
			if (!dir.startsWith(".")) {
				console.error(`  - ${dir}`);
			}
		}
		process.exit(1);
	}

	// Load script
	const scriptPath = join(videoDir, "script.ts");
	if (!existsSync(scriptPath)) {
		console.error(`❌ Error: Script not found: ${scriptPath}`);
		process.exit(1);
	}

	const scriptModule = await import(scriptPath);
	if (!scriptModule.scenes || !Array.isArray(scriptModule.scenes)) {
		console.error("❌ Error: script.ts must export a scenes array");
		process.exit(1);
	}
	if (!scriptModule.config) {
		console.error("❌ Error: script.ts must export a config object");
		process.exit(1);
	}

	const scenes: Scene[] = scriptModule.scenes;
	const config: VideoConfig = scriptModule.config;

	// Parse CLI options (filter out --force flag)
	const args = process.argv.slice(3).filter((arg) => arg !== "--force");
	const forceRegen = process.argv.includes("--force");

	const voiceArg = args[0] || DEFAULT_VOICE;
	const presetArg = (args[1] || DEFAULT_PRESET) as keyof typeof VOICE_PRESETS;
	const speedArg = args[2] ? parseFloat(args[2]) : DEFAULT_SPEED;

	if (!VOICES[voiceArg]) {
		console.error(`❌ Unknown voice: ${voiceArg}`);
		console.error("\nAvailable voices:");
		for (const name of Object.keys(VOICES)) {
			console.error(`  - ${name}`);
		}
		process.exit(1);
	}

	if (!VOICE_PRESETS[presetArg]) {
		console.error(`❌ Unknown preset: ${presetArg}`);
		console.error("\nAvailable presets: professional, energetic, calm");
		process.exit(1);
	}

	if (speedArg < 0.5 || speedArg > 2.0) {
		console.error(`❌ Speed must be between 0.5 and 2.0, got: ${speedArg}`);
		process.exit(1);
	}

	const options: AudioGenerationOptions = {
		voice: voiceArg,
		preset: presetArg,
		speed: speedArg,
	};

	console.log(`\n🎬 Processing video: ${videoId}`);
	console.log(`📊 Scenes: ${scenes.length}`);
	console.log(`🎙️ Voice: ${voiceArg} (${presetArg}, ${speedArg}x speed)`);
	console.log(`🎥 Config: ${config.width}x${config.height} @ ${config.fps}fps`);
	console.log(`⏸️ Scene gap: ${config.sceneGap}s`);
	if (forceRegen) {
		console.log(`🔄 Force regeneration enabled`);
	}

	const client = new ElevenLabsClient({ apiKey });

	// Load cache manifest (tracks input hashes for smart invalidation)
	const cacheManifest = loadCacheManifest(videoDir);

	try {
		// Check which scenes need processing
		const existingScenes: Map<string, ProcessedScene> = new Map();
		const scenesToProcess: Scene[] = [];

		if (!forceRegen) {
			console.log("\n🔍 Checking existing scenes...");
			for (const scene of scenes) {
				const currentHash = computeSceneHash(scene);
				const cachedHash = cacheManifest.scenes[scene.id]?.inputHash;
				const hashChanged = cachedHash && cachedHash !== currentHash;

				const existing = checkExistingScene(
					scene,
					videoDir,
					config.fps,
					cacheManifest,
				);
				if (existing) {
					existingScenes.set(scene.id, existing);
					console.log(`   ✅ ${scene.id}: valid (skipping)`);
				} else {
					scenesToProcess.push(scene);
					if (hashChanged) {
						console.log(`   🔄 ${scene.id}: script changed, regenerating`);
					} else {
						console.log(`   🔄 ${scene.id}: needs processing`);
					}
				}
			}
		} else {
			scenesToProcess.push(...scenes);
		}

		// Process scenes that need it
		let results: ProcessedScene[];
		if (scenesToProcess.length === 0) {
			console.log("\n✨ All scenes already processed and valid!");
			// biome-ignore lint/style/noNonNullAssertion: all scenes were validated above
			results = scenes.map((scene) => existingScenes.get(scene.id)!);
		} else {
			console.log(
				`\n📦 Processing ${scenesToProcess.length} scene(s) in parallel...`,
			);
			const processedResults = await Promise.all(
				scenesToProcess.map((scene) =>
					processScene(client, scene, videoDir, config.fps, options),
				),
			);

			// Update cache manifest for newly processed scenes
			for (const scene of scenesToProcess) {
				cacheManifest.scenes[scene.id] = {
					inputHash: computeSceneHash(scene),
					generatedAt: new Date().toISOString(),
				};
			}
			saveCacheManifest(videoDir, cacheManifest);

			// Merge existing and newly processed scenes (maintain order)
			results = scenes.map((scene) => {
				const processed = processedResults.find((r) => r.id === scene.id);
				// biome-ignore lint/style/noNonNullAssertion: scene is either just processed or in existingScenes
				return processed ?? existingScenes.get(scene.id)!;
			});
		}

		// Generate timing file
		generateTimingFile(results, config.fps, videoDir);

		// Copy audio to remotion public folder
		console.log("\n📋 Copying audio files to remotion public folder...");
		copyAudioToPublic(videoId, videoDir);

		// Summary
		const totalDuration = results.reduce((sum, r) => sum + r.audioDuration, 0);
		const totalWithGaps =
			totalDuration + config.sceneGap * (results.length - 1);
		const skippedCount = scenes.length - scenesToProcess.length;

		console.log("\n" + "─".repeat(60));
		console.log("✅ Processing complete!");
		console.log(`   📊 Scenes: ${results.length} total`);
		if (skippedCount > 0) {
			console.log(`   ⏭️ Skipped: ${skippedCount} (already valid)`);
			console.log(`   🔄 Processed: ${scenesToProcess.length}`);
		}
		console.log(`   ⏱️ Total audio duration: ${totalDuration.toFixed(2)}s`);
		console.log(`   ⏱️ Total with gaps: ${totalWithGaps.toFixed(2)}s`);
		console.log("\n💡 Next steps:");
		console.log("   1. Review timing.ts and scene components");
		console.log("   2. Preview with: cd ../remotion-video && bun run dev");
	} catch (error) {
		console.error("\n❌ Processing failed:", error);
		process.exit(1);
	}
}

main();
