/**
 * Type definitions for the declarative video pipeline
 *
 * These types enable LLM-authored scripts with timing markers
 * that are automatically resolved from audio transcriptions.
 */

/**
 * Reference to a specific moment in the audio timeline.
 * Used to define when visual elements should appear/change.
 */
export type TimingRef =
	| { type: "wordStart"; word: string; occurrence?: number; offset?: number }
	| { type: "wordEnd"; word: string; occurrence?: number; offset?: number }
	| { type: "sceneStart"; offset?: number }
	| { type: "sceneEnd"; offset?: number };

/**
 * A named timing marker for visual synchronization.
 * Defines a time range that can be referenced in scene components.
 */
export interface Marker {
	id: string;
	start: TimingRef;
	end: TimingRef;
}

/**
 * Scene definition with declarative timing markers.
 * This is what the LLM authors in script.ts.
 */
export interface Scene {
	id: string;
	/** Narration text for voiceover generation */
	narration: string;
	/** Description of what to show visually (for LLM/human reference) */
	visual: string;
	/** Timing markers that reference words in the narration */
	markers: Marker[];
}

/**
 * Resolved marker with computed frame numbers.
 * All times/frames are relative to the scene start (0).
 */
export interface ResolvedMarker {
	id: string;
	startTime: number; // seconds from scene audio start
	endTime: number;
	startFrame: number; // frames from scene start
	endFrame: number;
}

/**
 * Word from ElevenLabs transcription
 */
export interface TranscriptWord {
	text: string;
	start: number;
	end: number;
	type: "word" | "spacing";
}

/**
 * Full transcription result from ElevenLabs
 */
export interface TranscriptionResult {
	language_code: string;
	language_probability: number;
	text: string;
	words: TranscriptWord[];
}

/**
 * Processed scene with audio and timing info.
 * Output of the processing pipeline for each scene.
 */
export interface ProcessedScene {
	id: string;
	audioFile: string; // e.g., "hook.mp3"
	audioDuration: number; // seconds
	durationFrames: number; // frames at FPS
	transcription: TranscriptWord[];
	markers: Record<string, ResolvedMarker>;
}

/**
 * Video configuration - defined in script.ts
 */
export interface VideoConfig {
	fps: number;
	width: number;
	height: number;
	/** Seconds between scenes - configurable at composition time */
	sceneGap: number;
}

/**
 * Scene timing info as stored in timing.ts
 * No global positions - those are calculated at composition time
 */
export interface SceneTimingInfo {
	id: string;
	audioFile: string;
	audioDuration: number; // seconds
	durationFrames: number; // frames at FPS
	markers: Record<string, ResolvedMarker>;
}

/**
 * Validation result for marker checking
 */
export interface ValidationResult {
	valid: boolean;
	errors: string[];
}

/**
 * Voice settings for ElevenLabs
 */
export interface VoiceSettings {
	stability: number;
	style: number;
}

/**
 * Options for audio generation
 */
export interface AudioGenerationOptions {
	voice?: string;
	preset?: "professional" | "energetic" | "calm";
	speed?: number;
}
