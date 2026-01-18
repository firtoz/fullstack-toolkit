/**
 * Video: 2026-01-ui-comparison-tiktok
 * Description: Temperature control UI comparison with interactive cursor - TikTok vertical format (9:16)
 */

import type React from "react";
import { MainScene } from "./scenes/MainScene";

export const VIDEO_ID = "2026-01-ui-comparison-tiktok";

/**
 * UI Comparison Video - TikTok vertical format - No audio, pure visual animation
 */
export const UiComparisonTikTokVideo: React.FC = () => {
	const durationInFrames = 420; // 14 seconds at 30fps

	return <MainScene durationInFrames={durationInFrames} />;
};

// Composition configuration for TikTok (9:16 vertical)
export const uiComparisonTikTokComposition = {
	id: VIDEO_ID,
	component: UiComparisonTikTokVideo,
	durationInFrames: 420, // 14 seconds at 30fps
	fps: 30,
	width: 1080,
	height: 1920,
};
