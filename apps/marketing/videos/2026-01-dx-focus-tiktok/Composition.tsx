/**
 * Video: 2026-01-dx-focus-tiktok
 * Description: DX-focused video - TikTok vertical format (9:16)
 * Voice: Liam (energetic)
 */

import type React from "react";
import {
	createCompositionConfig,
	type SceneProps,
	VideoComposition,
} from "../../shared/components/VideoComposition";
import { CTAScene } from "./scenes/CTAScene";
import { FeaturesScene } from "./scenes/FeaturesScene";
import { HookScene } from "./scenes/HookScene";
import { ProblemScene } from "./scenes/ProblemScene";
import { SolutionScene } from "./scenes/SolutionScene";
import { config, VIDEO_ID } from "./script";
import { sceneTimings } from "./timing";

// Map scene IDs to their components
const sceneComponents: Record<string, React.FC<SceneProps>> = {
	hook: HookScene,
	problem: ProblemScene,
	solution: SolutionScene,
	features: FeaturesScene,
	cta: CTAScene,
};

/**
 * DX Focus Video - TikTok vertical format
 */
export const DxFocusTikTokVideo: React.FC = () => {
	return (
		<VideoComposition
			videoId={VIDEO_ID}
			config={config}
			sceneTimings={sceneTimings}
			sceneComponents={sceneComponents}
			backgroundColor="#0a0a0f"
			backgroundGradient="radial-gradient(ellipse at 50% 30%, rgba(249, 115, 22, 0.1) 0%, transparent 50%)"
		/>
	);
};

// Composition configuration
export const dxFocusTikTokComposition = createCompositionConfig(
	VIDEO_ID,
	config,
	sceneTimings,
	DxFocusTikTokVideo,
);
