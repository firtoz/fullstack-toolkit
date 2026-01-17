/**
 * Marker resolver - validates and resolves TimingRef to timestamps/frames
 *
 * Handles punctuation-lenient word matching and occurrence tracking.
 */

import type {
	Marker,
	ResolvedMarker,
	TimingRef,
	TranscriptWord,
	ValidationResult,
} from "../lib/video-types";

/**
 * Normalize word for matching - strips punctuation and lowercases.
 * "great," -> "great", "GREAT!" -> "great", "great..." -> "great"
 */
function normalizeWord(word: string): string {
	return word.toLowerCase().replace(/[^\w]/g, "");
}

/**
 * Build an index of words with occurrence tracking.
 * Returns a map of normalized word -> array of transcript words (for multiple occurrences)
 */
function buildWordIndex(
	transcriptWords: TranscriptWord[],
): Map<string, TranscriptWord[]> {
	const index = new Map<string, TranscriptWord[]>();

	for (const word of transcriptWords) {
		if (word.type !== "word") continue;

		const normalized = normalizeWord(word.text);
		if (!normalized) continue;

		const existing = index.get(normalized) || [];
		existing.push(word);
		index.set(normalized, existing);
	}

	return index;
}

/**
 * Get audio duration from transcript words
 */
function getAudioDuration(transcriptWords: TranscriptWord[]): number {
	if (transcriptWords.length === 0) return 0;

	let maxEnd = 0;
	for (const word of transcriptWords) {
		if (word.end > maxEnd) {
			maxEnd = word.end;
		}
	}
	return maxEnd;
}

/**
 * Resolve a single TimingRef to a timestamp
 */
function resolveTimingRef(
	ref: TimingRef,
	wordIndex: Map<string, TranscriptWord[]>,
	audioDuration: number,
): number | null {
	const offset = ref.offset ?? 0;

	switch (ref.type) {
		case "sceneStart":
			return 0 + offset;

		case "sceneEnd":
			return audioDuration + offset;

		case "wordStart": {
			const normalized = normalizeWord(ref.word);
			const occurrences = wordIndex.get(normalized);
			if (!occurrences || occurrences.length === 0) return null;

			const occurrence = ref.occurrence ?? 1;
			const index = occurrence - 1; // 1-indexed to 0-indexed
			if (index < 0 || index >= occurrences.length) return null;

			return occurrences[index].start + offset;
		}

		case "wordEnd": {
			const normalized = normalizeWord(ref.word);
			const occurrences = wordIndex.get(normalized);
			if (!occurrences || occurrences.length === 0) return null;

			const occurrence = ref.occurrence ?? 1;
			const index = occurrence - 1;
			if (index < 0 || index >= occurrences.length) return null;

			return occurrences[index].end + offset;
		}
	}
}

/**
 * Validate that all markers can be resolved from the transcription.
 * Returns validation result with any errors.
 */
export function validateMarkers(
	markers: Marker[],
	transcriptWords: TranscriptWord[],
): ValidationResult {
	const errors: string[] = [];
	const wordIndex = buildWordIndex(transcriptWords);
	const audioDuration = getAudioDuration(transcriptWords);

	for (const marker of markers) {
		// Validate start ref
		const startTime = resolveTimingRef(marker.start, wordIndex, audioDuration);
		if (startTime === null) {
			errors.push(
				`Marker "${marker.id}": could not resolve start ref - word "${
					(marker.start as { word?: string }).word ?? "N/A"
				}" not found in transcription`,
			);
		}

		// Validate end ref
		const endTime = resolveTimingRef(marker.end, wordIndex, audioDuration);
		if (endTime === null) {
			errors.push(
				`Marker "${marker.id}": could not resolve end ref - word "${
					(marker.end as { word?: string }).word ?? "N/A"
				}" not found in transcription`,
			);
		}

		// Validate that end is not before start (would break interpolation)
		if (startTime !== null && endTime !== null && endTime < startTime) {
			errors.push(
				`Marker "${marker.id}": end time (${endTime.toFixed(3)}s) is before start time (${startTime.toFixed(3)}s) - check word order in narration`,
			);
		}
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}

/**
 * Resolve all markers to timestamps and frames.
 * Assumes validation has already passed - all refs will resolve successfully.
 */
export function resolveMarkers(
	markers: Marker[],
	transcriptWords: TranscriptWord[],
	fps: number,
): Record<string, ResolvedMarker> {
	const wordIndex = buildWordIndex(transcriptWords);
	const audioDuration = getAudioDuration(transcriptWords);
	const resolved: Record<string, ResolvedMarker> = {};

	for (const marker of markers) {
		// biome-ignore lint/style/noNonNullAssertion: validation ensures all refs resolve
		const startTime = resolveTimingRef(marker.start, wordIndex, audioDuration)!;
		// biome-ignore lint/style/noNonNullAssertion: validation ensures all refs resolve
		const endTime = resolveTimingRef(marker.end, wordIndex, audioDuration)!;

		resolved[marker.id] = {
			id: marker.id,
			startTime: Math.round(startTime * 1000) / 1000,
			endTime: Math.round(endTime * 1000) / 1000,
			startFrame: Math.round(startTime * fps),
			endFrame: Math.round(endTime * fps),
		};
	}

	return resolved;
}

/**
 * Get list of all words referenced in markers (for debugging/reporting)
 */
export function getReferencedWords(markers: Marker[]): string[] {
	const words = new Set<string>();

	for (const marker of markers) {
		if ("word" in marker.start) {
			words.add(marker.start.word);
		}
		if ("word" in marker.end) {
			words.add(marker.end.word);
		}
	}

	return Array.from(words);
}

/**
 * Get word occurrences from transcription (for debugging)
 */
export function getWordOccurrences(
	transcriptWords: TranscriptWord[],
): Map<string, number> {
	const counts = new Map<string, number>();

	for (const word of transcriptWords) {
		if (word.type !== "word") continue;
		const normalized = normalizeWord(word.text);
		if (!normalized) continue;

		counts.set(normalized, (counts.get(normalized) || 0) + 1);
	}

	return counts;
}
