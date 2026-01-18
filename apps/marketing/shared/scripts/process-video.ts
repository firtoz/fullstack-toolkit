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
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { ElevenLabsClient } from "elevenlabs";
import { getAudioDurationInSeconds } from "get-audio-duration";
import type {
	AudioGenerationOptions,
	Marker,
	ProcessedScene,
	Scene,
	SceneTimingInfo,
	TranscriptionResult,
	VideoConfig,
} from "../lib/video-types";
import { resolveMarkers, validateMarkers } from "./marker-resolver";

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
 * Compute hash of audio inputs (narration + voice settings)
 * Step 1: If this changes, regenerate audio, transcription, and markers
 */
function computeAudioHash(
	narration: string,
	options: AudioGenerationOptions,
): string {
	const input = JSON.stringify({ narration, options });
	return createHash("sha256").update(input).digest("hex").substring(0, 16);
}

/**
 * Compute hash of audio file (for transcription caching)
 * Step 2: If audio changes, regenerate transcription and markers
 */
function computeTranscriptionHash(audioPath: string): string {
	if (!existsSync(audioPath)) return "";
	const stats = statSync(audioPath);
	return `${stats.size}-${stats.mtimeMs}`;
}

/**
 * Compute hash of markers
 * Step 3: If markers change, regenerate timing file only
 */
function computeMarkersHash(markers: Marker[]): string {
	const input = JSON.stringify(markers);
	return createHash("sha256").update(input).digest("hex").substring(0, 16);
}

/**
 * Cache manifest structure - stored in videoDir/cache-manifest.json
 * Tracks each processing step independently for granular cache invalidation
 */
interface CacheManifest {
	scenes: Record<
		string,
		{
			audioHash?: string; // Hash of narration + voice settings
			transcriptionHash?: string; // Hash/timestamp of audio file
			markersHash?: string; // Hash of markers
			generatedAt: string;
		}
	>;
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
 * Check scene cache status and return what needs to be regenerated
 * Returns an object indicating which steps need processing
 */
interface CacheStatus {
	needsAudio: boolean;
	needsTranscription: boolean;
	needsMarkers: boolean;
	existingData?: ProcessedScene;
}

async function checkSceneCache(
	scene: Scene,
	videoDir: string,
	videoId: string,
	fps: number,
	options: AudioGenerationOptions,
	cacheManifest: CacheManifest,
	sharedAudioId?: string,
): Promise<CacheStatus> {
	// Use shared audio ID if specified (for multi-aspect-ratio videos)
	const audioStorageId = sharedAudioId || videoId;
	const transcriptionStorageDir = sharedAudioId
		? join(VIDEOS_DIR, sharedAudioId)
		: videoDir;

	const audioPath = join(
		REMOTION_PUBLIC,
		audioStorageId,
		"audio",
		`${scene.id}.mp3`,
	);
	const transcriptionPath = join(
		transcriptionStorageDir,
		"transcriptions",
		`${scene.id}.json`,
	);

	const cachedInfo = cacheManifest.scenes[scene.id];
	const currentAudioHash = computeAudioHash(scene.narration, options);
	const currentMarkersHash = computeMarkersHash(scene.markers);

	// Step 1: Check audio cache
	const audioExists = existsSync(audioPath);
	const audioChanged = !cachedInfo || cachedInfo.audioHash !== currentAudioHash;

	if (!audioExists || audioChanged) {
		return { needsAudio: true, needsTranscription: true, needsMarkers: true };
	}

	// Step 2: Check transcription cache
	const transcriptionExists = existsSync(transcriptionPath);
	const currentTranscriptionHash = computeTranscriptionHash(audioPath);
	const transcriptionChanged =
		!cachedInfo || cachedInfo.transcriptionHash !== currentTranscriptionHash;

	if (!transcriptionExists || transcriptionChanged) {
		return {
			needsAudio: false,
			needsTranscription: true,
			needsMarkers: true,
		};
	}

	// Step 3: Check markers cache
	const markersChanged =
		!cachedInfo || cachedInfo.markersHash !== currentMarkersHash;

	if (markersChanged) {
		return {
			needsAudio: false,
			needsTranscription: false,
			needsMarkers: true,
		};
	}

	// Everything is cached - load and return existing data
	try {
		const transcriptionData = readFileSync(transcriptionPath, "utf-8");
		const transcription: TranscriptionResult = JSON.parse(transcriptionData);

		const resolvedMarkers = await resolveMarkers(
			scene.markers,
			transcription.words,
			audioPath,
			fps,
		);

		const audioDuration = await getAudioDurationInSeconds(audioPath);
		const durationFrames = Math.round(audioDuration * fps);

		return {
			needsAudio: false,
			needsTranscription: false,
			needsMarkers: false,
			existingData: {
				id: scene.id,
				audioFile: `${scene.id}.mp3`,
				audioDuration,
				durationFrames,
				transcription: transcription.words,
				markers: resolvedMarkers,
			},
		};
	} catch {
		// If we can't load existing data, regenerate markers
		return {
			needsAudio: false,
			needsTranscription: false,
			needsMarkers: true,
		};
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
 * Process a scene with granular caching - only regenerate what's needed
 */
async function processScene(
	client: ElevenLabsClient,
	scene: Scene,
	videoDir: string,
	videoId: string,
	fps: number,
	options: AudioGenerationOptions,
	cacheStatus: CacheStatus,
	sharedAudioId?: string,
	attempt = 1,
): Promise<ProcessedScene> {
	// Use shared audio ID if specified (for multi-aspect-ratio videos)
	const audioStorageId = sharedAudioId || videoId;
	const transcriptionStorageDir = sharedAudioId
		? join(VIDEOS_DIR, sharedAudioId)
		: videoDir;

	const audioPath = join(
		REMOTION_PUBLIC,
		audioStorageId,
		"audio",
		`${scene.id}.mp3`,
	);
	const transcriptionPath = join(
		transcriptionStorageDir,
		"transcriptions",
		`${scene.id}.json`,
	);

	console.log(`\n🎬 Processing scene: ${scene.id}`);

	let audioBuffer: Buffer | undefined;
	let transcription: TranscriptionResult;

	// Step 1: Generate audio if needed
	if (cacheStatus.needsAudio) {
		console.log(`   🎙️ Generating audio (attempt ${attempt}/${MAX_RETRIES})...`);
		audioBuffer = await generateAudio(client, scene.narration, options);

		const audioDir = join(REMOTION_PUBLIC, audioStorageId, "audio");
		mkdirSync(audioDir, { recursive: true });
		writeFileSync(audioPath, audioBuffer);
		console.log(`   💾 Saved audio: ${audioPath}`);
	} else {
		console.log(`   ✓ Using cached audio`);
	}

	// Step 2: Transcribe if needed
	if (cacheStatus.needsTranscription) {
		console.log("   📝 Transcribing audio...");
		transcription = await transcribeAudio(client, audioPath);
		console.log(
			`   🔤 Words detected: ${transcription.words.filter((w) => w.type === "word").length}`,
		);

		const transcriptionsDir = join(transcriptionStorageDir, "transcriptions");
		mkdirSync(transcriptionsDir, { recursive: true });
		writeFileSync(transcriptionPath, JSON.stringify(transcription, null, 2));
		console.log(`   💾 Saved transcription`);
	} else {
		console.log(`   ✓ Using cached transcription`);
		const transcriptionData = readFileSync(transcriptionPath, "utf-8");
		transcription = JSON.parse(transcriptionData);
	}

	// Step 3: Validate and resolve markers if needed
	if (cacheStatus.needsMarkers) {
		console.log("   🎯 Validating markers...");
		const validation = await validateMarkers(
			scene.markers,
			transcription.words,
			audioPath,
		);

		if (!validation.valid) {
			console.log(`   ⚠️ Validation failed:`);
			for (const error of validation.errors) {
				console.log(`      - ${error}`);
			}

			// Only save attempt if we generated new audio
			if (audioBuffer) {
				await saveAttempt(
					videoDir,
					scene.id,
					attempt,
					audioBuffer,
					transcription,
					validation.errors,
				);
			}

			if (attempt < MAX_RETRIES && cacheStatus.needsAudio) {
				console.log(`   🔄 Retrying audio generation...`);
				return processScene(
					client,
					scene,
					videoDir,
					videoId,
					fps,
					options,
					{ needsAudio: true, needsTranscription: true, needsMarkers: true },
					sharedAudioId,
					attempt + 1,
				);
			}

			throw new Error(
				`Scene "${scene.id}" failed validation:\n${validation.errors.join("\n")}`,
			);
		}

		console.log(`   ✅ Markers validated`);
	} else {
		console.log(`   ✓ Using cached markers`);
	}

	// Resolve markers and get duration
	const resolvedMarkers = await resolveMarkers(
		scene.markers,
		transcription.words,
		audioPath,
		fps,
	);

	const audioDuration = await getAudioDurationInSeconds(audioPath);
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

import type { SceneTimingInfo } from "../../shared/lib/video-types";

export const FPS = ${fps};

export const sceneTimings: SceneTimingInfo[] = ${JSON.stringify(sceneTimings, null, "\t")};
`;

	const timingPath = join(videoDir, "timing.ts");
	writeFileSync(timingPath, timingCode);
	console.log(`\n✅ Generated timing file: ${timingPath}`);
}

/**
 * Run linter on generated files to fix formatting
 */
async function lintGeneratedFiles(videoDir: string): Promise<void> {
	const { spawnSync } = await import("node:child_process");

	console.log("\n🔧 Running linter on generated files...");

	// Run biome check --write on the video directory
	const result = spawnSync("bunx", ["biome", "check", "--write", videoDir], {
		cwd: join(__dirname, "..", ".."),
		stdio: "pipe",
		encoding: "utf-8",
	});

	if (result.error) {
		console.warn(`   ⚠️ Warning: Failed to run linter: ${result.error.message}`);
		return;
	}

	if (result.status !== 0 && result.stderr) {
		console.warn(`   ⚠️ Warning: Linter exited with errors:\n${result.stderr}`);
		return;
	}

	console.log("   ✅ Linter formatting applied");
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

	const sharedAudioId = config.sharedAudioId;
	const cacheStorageDir = sharedAudioId
		? join(VIDEOS_DIR, sharedAudioId)
		: videoDir;

	console.log(`\n🎬 Processing video: ${videoId}`);
	console.log(`📊 Scenes: ${scenes.length}`);
	console.log(`🎙️ Voice: ${voiceArg} (${presetArg}, ${speedArg}x speed)`);
	console.log(`🎥 Config: ${config.width}x${config.height} @ ${config.fps}fps`);
	console.log(`⏸️ Scene gap: ${config.sceneGap}s`);
	if (sharedAudioId) {
		console.log(`🔗 Shared audio: ${sharedAudioId}`);
	}
	if (forceRegen) {
		console.log(`🔄 Force regeneration enabled`);
	}

	const client = new ElevenLabsClient({ apiKey });

	// Load cache manifest from shared location if using shared audio
	const cacheManifest = loadCacheManifest(cacheStorageDir);

	try {
		// Check cache status for all scenes
		console.log("\n🔍 Checking cache status...");
		const sceneStatuses = await Promise.all(
			scenes.map(async (scene) => ({
				scene,
				status: await checkSceneCache(
					scene,
					videoDir,
					videoId,
					config.fps,
					options,
					cacheManifest,
					sharedAudioId,
				),
			})),
		);

		// Display cache status
		for (const { scene, status } of sceneStatuses) {
			if (forceRegen) {
				console.log(`   🔄 ${scene.id}: force regeneration`);
			} else if (
				!status.needsAudio &&
				!status.needsTranscription &&
				!status.needsMarkers
			) {
				console.log(`   ✅ ${scene.id}: fully cached`);
			} else {
				const steps = [];
				if (status.needsAudio) steps.push("audio");
				if (status.needsTranscription) steps.push("transcription");
				if (status.needsMarkers) steps.push("markers");
				console.log(`   🔄 ${scene.id}: regenerating ${steps.join(", ")}`);
			}
		}

		// Process scenes (in parallel where possible)
		const scenesToProcess = forceRegen
			? scenes.map((scene) => ({
					scene,
					status: {
						needsAudio: true,
						needsTranscription: true,
						needsMarkers: true,
					} as CacheStatus,
				}))
			: sceneStatuses.filter(
					({ status }) =>
						status.needsAudio ||
						status.needsTranscription ||
						status.needsMarkers,
				);

		let results: ProcessedScene[];

		if (scenesToProcess.length === 0) {
			console.log("\n✨ All scenes fully cached!");
			// biome-ignore lint/style/noNonNullAssertion: all scenes have existingData when nothing needs processing
			results = sceneStatuses.map(({ status }) => status.existingData!);
		} else {
			console.log(`\n📦 Processing ${scenesToProcess.length} scene(s)...`);
			const processedResults = await Promise.all(
				scenesToProcess.map(({ scene, status }) =>
					processScene(
						client,
						scene,
						videoDir,
						videoId,
						config.fps,
						options,
						status,
						sharedAudioId,
					),
				),
			);

			// Update cache manifest with new hashes (save to shared location if using shared audio)
			for (const { scene, status } of scenesToProcess) {
				const entry = cacheManifest.scenes[scene.id] || { generatedAt: "" };

				if (status.needsAudio) {
					entry.audioHash = computeAudioHash(scene.narration, options);
				}

				const audioStorageId = sharedAudioId || videoId;
				const audioPath = join(
					REMOTION_PUBLIC,
					audioStorageId,
					"audio",
					`${scene.id}.mp3`,
				);
				if (status.needsTranscription && existsSync(audioPath)) {
					entry.transcriptionHash = computeTranscriptionHash(audioPath);
				}

				if (status.needsMarkers) {
					entry.markersHash = computeMarkersHash(scene.markers);
				}

				entry.generatedAt = new Date().toISOString();
				cacheManifest.scenes[scene.id] = entry;
			}
			saveCacheManifest(cacheStorageDir, cacheManifest);

			// Merge existing and newly processed scenes (maintain order)
			results = scenes.map((scene) => {
				const processed = processedResults.find((r) => r.id === scene.id);
				if (processed) return processed;

				const cached = sceneStatuses.find((s) => s.scene.id === scene.id);
				// biome-ignore lint/style/noNonNullAssertion: cached scene must exist and have existingData if not processed
				return cached!.status.existingData!;
			});
		}

		// Generate timing file
		generateTimingFile(results, config.fps, videoDir);

		// Run linter on generated files
		await lintGeneratedFiles(videoDir);

		// Summary
		const totalDuration = results.reduce((sum, r) => sum + r.audioDuration, 0);
		const totalWithGaps =
			totalDuration + config.sceneGap * (results.length - 1);
		const skippedCount = scenes.length - scenesToProcess.length;

		console.log(`\n${"─".repeat(60)}`);
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
