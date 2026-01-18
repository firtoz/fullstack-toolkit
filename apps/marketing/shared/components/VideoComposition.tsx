/**
 * Shared Video Composition Component
 *
 * Reusable composition logic for all marketing videos.
 * Handles scene sequencing, audio sync, gaps, and prefetching.
 */

import { Audio } from "@remotion/media";
import type React from "react";
import { useEffect, useMemo } from "react";
import { AbsoluteFill, prefetch, Sequence, staticFile } from "remotion";
import type {
	ResolvedMarker,
	SceneTimingInfo,
	VideoConfig,
} from "../lib/video-types";

export interface SceneProps {
	durationInFrames: number;
	markers: Record<string, ResolvedMarker>;
}

export interface VideoCompositionProps {
	/** Video ID for asset paths (e.g., "2026-01-dx-focus") */
	videoId: string;
	/** Video configuration (fps, dimensions, scene gap) */
	config: VideoConfig;
	/** Scene timing information with resolved markers */
	sceneTimings: SceneTimingInfo[];
	/** Map of scene IDs to their React components */
	sceneComponents: Record<string, React.FC<SceneProps>>;
	/** Background color (default: #0a0a0f) */
	backgroundColor?: string;
	/** Background gradient CSS (default: orange radial gradient) */
	backgroundGradient?: string;
}

/**
 * Calculate scene offset and adjusted markers to handle negative marker frames.
 * If markers start before frame 0 (e.g., startFrame: -10), we need to:
 * 1. Offset all markers forward by that amount
 * 2. Extend the scene duration to accommodate the pre-roll
 * 3. Delay the audio by that offset (handled in scene render)
 */
function calculateSceneAdjustments(timing: SceneTimingInfo): {
	offsetFrames: number;
	adjustedMarkers: Record<string, ResolvedMarker>;
	durationFrames: number;
} {
	const markers = Object.values(timing.markers);

	// Find the minimum startFrame (could be negative)
	let minStartFrame = 0;
	let maxEndFrame = timing.durationFrames;

	for (const marker of markers) {
		minStartFrame = Math.min(minStartFrame, marker.startFrame);
		maxEndFrame = Math.max(maxEndFrame, marker.endFrame);
	}

	// If we have negative frames, we need to offset everything
	const offsetFrames = -minStartFrame; // e.g., if min is -10, offset is 10

	// Adjust all markers by the offset
	const adjustedMarkers: Record<string, ResolvedMarker> = {};
	for (const [key, marker] of Object.entries(timing.markers)) {
		adjustedMarkers[key] = {
			...marker,
			startFrame: marker.startFrame + offsetFrames,
			endFrame: marker.endFrame + offsetFrames,
		};
	}

	// Total duration includes offset (pre-roll) + max end frame
	const durationFrames = maxEndFrame + offsetFrames;

	return {
		offsetFrames,
		adjustedMarkers,
		durationFrames,
	};
}

/**
 * Calculate the actual duration for a scene, accounting for marker extensions and negative frames
 */
function calculateSceneDuration(timing: SceneTimingInfo): number {
	return calculateSceneAdjustments(timing).durationFrames;
}

/**
 * Calculate total frames including gaps between scenes and marker extensions
 */
function calculateTotalFrames(
	sceneTimings: SceneTimingInfo[],
	gapFrames: number,
): number {
	// Handle empty scenes array
	if (sceneTimings.length === 0) {
		return 0;
	}

	const totalSceneDuration = sceneTimings.reduce(
		(sum, s) => sum + calculateSceneDuration(s),
		0,
	);
	const totalGaps = gapFrames * (sceneTimings.length - 1);
	return totalSceneDuration + totalGaps;
}

/**
 * Reusable video composition component
 *
 * Use this for all marketing videos to maintain consistency in:
 * - Scene sequencing and gaps
 * - Audio prefetching
 * - Marker-driven timing
 * - Background styling
 */
export const VideoComposition: React.FC<VideoCompositionProps> = ({
	videoId,
	config,
	sceneTimings,
	sceneComponents,
	backgroundColor = "#0a0a0f",
	backgroundGradient = "radial-gradient(ellipse at 50% 0%, rgba(249, 115, 22, 0.1) 0%, transparent 50%)",
}) => {
	const gapFrames = useMemo(
		() => Math.round(config.sceneGap * config.fps),
		[config.sceneGap, config.fps],
	);

	// Use shared audio ID if specified, otherwise use videoId
	const audioVideoId = config.sharedAudioId || videoId;

	// Prefetch all audio files
	useEffect(() => {
		sceneTimings.forEach((timing) => {
			prefetch(staticFile(`${audioVideoId}/audio/${timing.audioFile}`));
		});
	}, [audioVideoId, sceneTimings]);

	// Calculate timeline positions - driven by audio duration + gaps + marker extensions + offsets
	const scenePositions = useMemo(
		() =>
			sceneTimings.map((timing, index) => {
				// Get adjustments (handles negative frames and marker extensions)
				const adjustments = calculateSceneAdjustments(timing);

				// Each scene starts after previous scenes (with their extended durations) + gaps
				const startFrame =
					index === 0
						? 0
						: sceneTimings
								.slice(0, index)
								.reduce((sum, s) => sum + calculateSceneDuration(s), 0) +
							gapFrames * index;

				return {
					timing,
					startFrame,
					durationFrames: adjustments.durationFrames,
					audioOffsetFrames: adjustments.offsetFrames,
					adjustedMarkers: adjustments.adjustedMarkers,
				};
			}),
		[sceneTimings, gapFrames],
	);

	return (
		<AbsoluteFill
			style={{
				backgroundColor,
				fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
			}}
		>
			{/* Background gradient */}
			<AbsoluteFill
				style={{
					background: backgroundGradient,
				}}
			/>

			{/* Scenes: audio-driven sequences with visuals positioned inside */}
			{scenePositions.map(
				({
					timing,
					startFrame,
					durationFrames,
					audioOffsetFrames,
					adjustedMarkers,
				}) => {
					const SceneComponent = sceneComponents[timing.id];
					if (!SceneComponent) {
						console.warn(`Scene component not found for: ${timing.id}`);
						return null;
					}

					return (
						<Sequence
							key={timing.id}
							from={startFrame}
							durationInFrames={durationFrames}
							name={timing.id}
							premountFor={15}
						>
							{/* Audio may be offset if markers start before frame 0 */}
							{audioOffsetFrames > 0 ? (
								<Sequence from={audioOffsetFrames}>
									<Audio
										src={staticFile(
											`${audioVideoId}/audio/${timing.audioFile}`,
										)}
										name={timing.audioFile}
									/>
								</Sequence>
							) : (
								<Audio
									src={staticFile(`${audioVideoId}/audio/${timing.audioFile}`)}
									name={timing.audioFile}
								/>
							)}

							{/* Visuals position themselves relative to adjusted markers */}
							<SceneComponent
								durationInFrames={durationFrames}
								markers={adjustedMarkers}
							/>
						</Sequence>
					);
				},
			)}
		</AbsoluteFill>
	);
};

/**
 * Helper to create composition config for Remotion
 */
export function createCompositionConfig(
	videoId: string,
	config: VideoConfig,
	sceneTimings: SceneTimingInfo[],
	component: React.FC,
) {
	const gapFrames = Math.round(config.sceneGap * config.fps);

	return {
		id: videoId,
		component,
		durationInFrames: calculateTotalFrames(sceneTimings, gapFrames),
		fps: config.fps,
		width: config.width,
		height: config.height,
	};
}
