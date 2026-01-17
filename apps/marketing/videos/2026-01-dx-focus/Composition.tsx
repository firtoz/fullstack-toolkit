/**
 * Video: 2026-01-dx-focus
 * Description: DX-focused video - ease of use with dynamic fetchers/submitters
 * Voice: Liam (energetic)
 */

import { Audio } from "@remotion/media";
import { useEffect, useMemo } from "react";
import { AbsoluteFill, prefetch, Sequence, staticFile } from "remotion";
import type { ResolvedMarker } from "../../shared/lib/video-types";
import { CTAScene } from "./scenes/CTAScene";
import { FeaturesScene } from "./scenes/FeaturesScene";
import { HookScene } from "./scenes/HookScene";
import { ProblemScene } from "./scenes/ProblemScene";
import { SolutionScene } from "./scenes/SolutionScene";
import { config, VIDEO_ID } from "./script";
import { FPS, sceneTimings } from "./timing";

interface SceneProps {
	durationInFrames: number;
	markers: Record<string, ResolvedMarker>;
}

const sceneComponents: { [key: string]: React.FC<SceneProps> } = {
	hook: HookScene,
	problem: ProblemScene,
	solution: SolutionScene,
	features: FeaturesScene,
	cta: CTAScene,
};

/**
 * Calculate total frames including gaps between scenes
 */
function calculateTotalFrames(gapFrames: number): number {
	const totalSceneDuration = sceneTimings.reduce(
		(sum, s) => sum + s.durationFrames,
		0,
	);
	const totalGaps = gapFrames * (sceneTimings.length - 1);
	return totalSceneDuration + totalGaps;
}

export const DxFocusVideo: React.FC = () => {
	const gapFrames = useMemo(() => Math.round(config.sceneGap * FPS), []);

	useEffect(() => {
		sceneTimings.forEach((timing) => {
			prefetch(staticFile(`${VIDEO_ID}/audio/${timing.audioFile}`));
		});
	}, []);

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

				// timing.markers

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
					// Sequence duration is the audio duration
					durationFrames,
				};
			}),
		[gapFrames],
	);

	return (
		<AbsoluteFill
			style={{
				backgroundColor: "#0a0a0f",
				fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
			}}
		>
			{/* Background gradient - orange themed, visible during gaps */}
			<AbsoluteFill
				style={{
					background:
						"radial-gradient(ellipse at 50% 0%, rgba(249, 115, 22, 0.1) 0%, transparent 50%)",
				}}
			/>

			{/* Scenes: audio-driven sequences with visuals positioned inside */}
			{scenePositions.map(({ timing, startFrame, durationFrames }) => {
				const SceneComponent = sceneComponents[timing.id];
				if (!SceneComponent) return null;

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
							src={staticFile(`${VIDEO_ID}/audio/${timing.audioFile}`)}
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

// Composition configuration
const gapFrames = Math.round(config.sceneGap * FPS);

export const dxFocusComposition = {
	id: VIDEO_ID,
	component: DxFocusVideo,
	durationInFrames: calculateTotalFrames(gapFrames),
	fps: FPS,
	width: config.width,
	height: config.height,
};
