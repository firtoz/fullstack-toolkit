/**
 * Video: 2026-01-meta-workflow
 * Description: "Prompt to Video" workflow - AI as the creative partner
 * Voice: Liam (energetic)
 */

import type React from "react";
import {
	createCompositionConfig,
	type SceneProps,
	VideoComposition,
} from "../../shared/components/VideoComposition";
import { CTAScene } from "./scenes/CTAScene";
import { ExecutionScene } from "./scenes/ExecutionScene";
import { HookScene } from "./scenes/HookScene";
import { PromptScene } from "./scenes/PromptScene";
import { RefineScene } from "./scenes/RefineScene";
import { config, VIDEO_ID } from "./script";
import { sceneTimings } from "./timing";

// Map scene IDs to their components
const sceneComponents: Record<string, React.FC<SceneProps>> = {
	hook: HookScene,
	prompt: PromptScene,
	refine: RefineScene,
	execution: ExecutionScene,
	cta: CTAScene,
};

/**
 * Meta Workflow Video - uses shared VideoComposition
 */
export const MetaWorkflowVideo: React.FC = () => {
	return (
		<VideoComposition
			videoId={VIDEO_ID}
			config={config}
			sceneTimings={sceneTimings}
			sceneComponents={sceneComponents}
			backgroundColor="#0a0a0f"
			backgroundGradient="radial-gradient(ellipse at 50% 0%, rgba(99, 102, 241, 0.1) 0%, transparent 50%)"
		/>
	);
};

// Composition configuration
export const metaWorkflowComposition = createCompositionConfig(
	VIDEO_ID,
	config,
	sceneTimings,
	MetaWorkflowVideo,
);
