/**
 * Video: 2026-01-ui-comparison
 * Description: Temperature control UI comparison with interactive cursor
 */

import type React from "react";
import { MainScene } from "./scenes/MainScene";

export const VIDEO_ID = "2026-01-ui-comparison";

/**
 * UI Comparison Video - No audio, pure visual animation
 */
export const UiComparisonVideo: React.FC = () => {
	const durationInFrames = 420; // 14 seconds at 30fps

	return <MainScene durationInFrames={durationInFrames} />;
};

// Composition configuration
export const uiComparisonComposition = {
	id: VIDEO_ID,
	component: UiComparisonVideo,
	durationInFrames: 420, // 14 seconds at 30fps
	fps: 30,
	width: 1920,
	height: 1080,
};
