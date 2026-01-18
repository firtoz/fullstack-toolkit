import { Composition } from "remotion";

// Video: 2026-01-dx-focus
import { dxFocusComposition } from "../../videos/2026-01-dx-focus/Composition";

// Video: 2026-01-meta-workflow
import { metaWorkflowComposition } from "../../videos/2026-01-meta-workflow/Composition";

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

			{/* 2026-01-meta-workflow: Meta video explaining the marketing package workflow */}
			<Composition
				id={metaWorkflowComposition.id}
				component={metaWorkflowComposition.component}
				durationInFrames={metaWorkflowComposition.durationInFrames}
				fps={metaWorkflowComposition.fps}
				width={metaWorkflowComposition.width}
				height={metaWorkflowComposition.height}
			/>
		</>
	);
};
