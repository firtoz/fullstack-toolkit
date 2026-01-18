import { Composition } from "remotion";

// Video: 2026-01-dx-focus
import { dxFocusComposition } from "../../videos/2026-01-dx-focus/Composition";

// Video: 2026-01-dx-focus-tiktok
import { dxFocusTikTokComposition } from "../../videos/2026-01-dx-focus-tiktok/Composition";

// Video: 2026-01-meta-workflow
import { metaWorkflowComposition } from "../../videos/2026-01-meta-workflow/Composition";

// Video: 2026-01-meta-workflow-tiktok
import { metaWorkflowTikTokComposition } from "../../videos/2026-01-meta-workflow-tiktok/Composition";

// Video: 2026-01-ui-comparison
import { uiComparisonComposition } from "../../videos/2026-01-ui-comparison/Composition";

// Video: 2026-01-ui-comparison-tiktok
import { uiComparisonTikTokComposition } from "../../videos/2026-01-ui-comparison-tiktok/Composition";

export const RemotionRoot: React.FC = () => {
	return (
		<>
			{/* 2026-01-dx-focus: DX-focused (ease of use, dynamic fetchers) */}
			<Composition
				id={dxFocusComposition.id}
				component={dxFocusComposition.component}
				durationInFrames={dxFocusComposition.durationInFrames}
				fps={dxFocusComposition.fps}
				width={dxFocusComposition.width}
				height={dxFocusComposition.height}
			/>

			{/* 2026-01-dx-focus-tiktok: DX-focused (TikTok vertical 9:16) */}
			<Composition
				id={dxFocusTikTokComposition.id}
				component={dxFocusTikTokComposition.component}
				durationInFrames={dxFocusTikTokComposition.durationInFrames}
				fps={dxFocusTikTokComposition.fps}
				width={dxFocusTikTokComposition.width}
				height={dxFocusTikTokComposition.height}
			/>

			{/* 2026-01-meta-workflow: Meta video explaining the marketing package workflow */}
			<Composition
				id={metaWorkflowComposition.id}
				component={metaWorkflowComposition.component}
				durationInFrames={metaWorkflowComposition.durationInFrames}
				fps={metaWorkflowComposition.fps}
				width={metaWorkflowComposition.width}
				height={metaWorkflowComposition.height}
			/>

			{/* 2026-01-meta-workflow-tiktok: Meta workflow (TikTok vertical 9:16) */}
			<Composition
				id={metaWorkflowTikTokComposition.id}
				component={metaWorkflowTikTokComposition.component}
				durationInFrames={metaWorkflowTikTokComposition.durationInFrames}
				fps={metaWorkflowTikTokComposition.fps}
				width={metaWorkflowTikTokComposition.width}
				height={metaWorkflowTikTokComposition.height}
			/>

			{/* 2026-01-ui-comparison: Temperature control UI comparison */}
			<Composition
				id={uiComparisonComposition.id}
				component={uiComparisonComposition.component}
				durationInFrames={uiComparisonComposition.durationInFrames}
				fps={uiComparisonComposition.fps}
				width={uiComparisonComposition.width}
				height={uiComparisonComposition.height}
			/>

			{/* 2026-01-ui-comparison-tiktok: UI comparison (TikTok vertical 9:16) */}
			<Composition
				id={uiComparisonTikTokComposition.id}
				component={uiComparisonTikTokComposition.component}
				durationInFrames={uiComparisonTikTokComposition.durationInFrames}
				fps={uiComparisonTikTokComposition.fps}
				width={uiComparisonTikTokComposition.width}
				height={uiComparisonTikTokComposition.height}
			/>
		</>
	);
};
