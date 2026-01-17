/**
 * Video: 2026-01-dx-focus
 * Description: DX-focused video - ease of use with dynamic fetchers/submitters
 * Voice: Liam (energetic)
 */

import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { sceneTimings, FPS } from "./timing";
import { config, VIDEO_ID } from "./script";
import type { ResolvedMarker } from "../../shared/lib/video-types";
import { HookScene } from "./scenes/HookScene";
import { ProblemScene } from "./scenes/ProblemScene";
import { SolutionScene } from "./scenes/SolutionScene";
import { FeaturesScene } from "./scenes/FeaturesScene";
import { CTAScene } from "./scenes/CTAScene";

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
	const gapFrames = Math.round(config.sceneGap * FPS);

	// Accumulator for timeline position - advances through the map
	let timelinePosition = 0;

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

			{/* Render each scene with per-scene audio */}
			{sceneTimings.map((timing, index) => {
				const SceneComponent = sceneComponents[timing.id];
				if (!SceneComponent) return null;

				// Capture where THIS scene starts on the timeline
				const startFrame = timelinePosition;

				// Advance accumulator for NEXT iteration
				timelinePosition += timing.durationFrames;
				if (index < sceneTimings.length - 1) {
					timelinePosition += gapFrames; // Add gap after each scene (except last)
				}

				return (
					<Sequence
						key={timing.id}
						from={startFrame}
						durationInFrames={timing.durationFrames}
						name={timing.id}
					>
						{/* Per-scene audio */}
						<Audio src={staticFile(`${VIDEO_ID}/audio/${timing.audioFile}`)} />

						{/* Scene visuals - markers are scene-local (start at 0) */}
						<SceneComponent
							durationInFrames={timing.durationFrames}
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
