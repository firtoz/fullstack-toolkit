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
 * Calculate total frames including gaps between scenes
 */
function calculateTotalFrames(
	sceneTimings: SceneTimingInfo[],
	gapFrames: number,
): number {
	const totalSceneDuration = sceneTimings.reduce(
		(sum, s) => sum + s.durationFrames,
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

	// Prefetch all audio files
	useEffect(() => {
		sceneTimings.forEach((timing) => {
			prefetch(staticFile(`${videoId}/audio/${timing.audioFile}`));
		});
	}, [videoId, sceneTimings]);

	// Calculate timeline positions - driven by audio duration + gaps
	const scenePositions = useMemo(
		() =>
			sceneTimings.map((timing, index) => {
				// Each scene starts after previous scenes + gaps
				const startFrame =
					index === 0
						? 0
						: sceneTimings
								.slice(0, index)
								.reduce((sum, s) => sum + s.durationFrames, 0) +
							gapFrames * index;

				// Calculate duration - use maximum of audio duration or longest marker
				let durationFrames = timing.durationFrames;

				const markers = Object.values(timing.markers);
				if (markers.length > 0) {
					for (const marker of markers) {
						durationFrames = Math.max(durationFrames, marker.endFrame);
					}
				}

				return {
					timing,
					startFrame,
					durationFrames,
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
			{scenePositions.map(({ timing, startFrame, durationFrames }) => {
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
						premountFor={gapFrames * 2}
					>
						{/* Audio defines the sequence timeline */}
						<Audio
							src={staticFile(`${videoId}/audio/${timing.audioFile}`)}
							name={timing.audioFile}
						/>

						{/* Visuals position themselves relative to audio via markers */}
						<SceneComponent
							durationInFrames={durationFrames}
							markers={timing.markers}
						/>
					</Sequence>
				);
			})}
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
