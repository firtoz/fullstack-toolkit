import {
	AbsoluteFill,
	interpolate,
	useCurrentFrame,
	staticFile,
	Img,
} from "remotion";
import type { SceneProps } from "../../../shared/components/VideoComposition";

export const RefineScene: React.FC<SceneProps> = ({ markers }) => {
	const frame = useCurrentFrame();

	// Get all markers
	const flashier = markers.flashier;
	const justAsk = markers.justAsk;
	const makeSexy = markers.makeSexy;
	const makeCool = markers.makeCool;
	const updatesInstantly = markers.updatesInstantly;

	// Chat bubbles appear at different times
	const flashierBubbleOpacity = interpolate(
		frame,
		[flashier.startFrame, flashier.startFrame + 6],
		[0, 1],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" }
	);

	// "Just ask" pulse effect
	const justAskPulse = interpolate(
		frame,
		[justAsk.startFrame, justAsk.startFrame + 10, justAsk.startFrame + 20],
		[1, 1.1, 1],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" }
	);

	// "Sexy" bubble and effect
	const sexyBubbleOpacity = interpolate(
		frame,
		[makeSexy.startFrame, makeSexy.startFrame + 6],
		[0, 1],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" }
	);

	// "Cool" bubble and effect
	const coolBubbleOpacity = interpolate(
		frame,
		[makeCool.startFrame, makeCool.startFrame + 6],
		[0, 1],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" }
	);

	// Progressive transformation based on each step
	// Step 1: After "sexy" - 33% transformed
	// Step 2: After "cool" - 66% transformed
	// Step 3: "updates instantly" - 100% transformed
	const step1Progress = interpolate(
		frame,
		[makeSexy.startFrame, makeSexy.startFrame + 8],
		[0, 0.33],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" }
	);

	const step2Progress = interpolate(
		frame,
		[makeCool.startFrame, makeCool.startFrame + 8],
		[0, 0.33],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" }
	);

	const step3Progress = interpolate(
		frame,
		[updatesInstantly.startFrame, updatesInstantly.startFrame + 10],
		[0, 0.34],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" }
	);

	const transformProgress = Math.min(1, step1Progress + step2Progress + step3Progress);

	// Scale punch on final transform
	const punchScale = interpolate(
		frame,
		[
			updatesInstantly.startFrame,
			updatesInstantly.startFrame + 6,
			updatesInstantly.startFrame + 12,
		],
		[1, 1.08, 1],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" }
	);

	return (
		<AbsoluteFill style={{ backgroundColor: "#000" }}>
			{/* The BEFORE State - plain/boring */}
			<AbsoluteFill
				style={{
					opacity: 1 - transformProgress,
					transform: `scale(${punchScale})`,
				}}
			>
				<Img
					src={staticFile("2026-01-meta-workflow/images/refine-before.png")}
					style={{
						width: "100%",
						height: "100%",
						objectFit: "cover",
					}}
				/>
				<div
					style={{
						position: "absolute",
						inset: 0,
						backgroundColor: "rgba(0,0,0,0.15)",
					}}
				/>
			</AbsoluteFill>

			{/* The AFTER State - flashy/cool */}
			<AbsoluteFill
				style={{
					opacity: transformProgress,
					transform: `scale(${punchScale})`,
				}}
			>
				<Img
					src={staticFile("2026-01-meta-workflow/images/refine-after.png")}
					style={{
						width: "100%",
						height: "100%",
						objectFit: "cover",
					}}
				/>
			</AbsoluteFill>

			{/* Chat Bubbles Container */}
			<AbsoluteFill
				style={{
					justifyContent: "flex-start",
					alignItems: "flex-start",
					padding: 60,
					gap: 20,
					flexDirection: "column",
				}}
			>
				{/* "Make it flashier!" bubble */}
				<ChatBubble
					text="Make it flashier!"
					opacity={flashierBubbleOpacity}
					scale={justAskPulse}
					color="#3b82f6"
				/>

				{/* "Make it sexy" bubble */}
				<ChatBubble
					text="Make it sexy."
					opacity={sexyBubbleOpacity}
					scale={1}
					color="#ec4899"
				/>

				{/* "Make it cool" bubble */}
				<ChatBubble
					text="Make it cool."
					opacity={coolBubbleOpacity}
					scale={1}
					color="#06b6d4"
				/>
			</AbsoluteFill>

			{/* Step-by-step glow effects */}
			{transformProgress > 0 && transformProgress < 1 && (
				<AbsoluteFill
					style={{
						background: `linear-gradient(45deg, 
							rgba(236, 72, 153, ${transformProgress * 0.3}), 
							rgba(139, 92, 246, ${transformProgress * 0.3}),
							rgba(6, 182, 212, ${transformProgress * 0.3})
						)`,
						mixBlendMode: "overlay",
					}}
				/>
			)}

			{/* "INSTANTLY UPDATED" badge after full transform */}
			{transformProgress >= 1 && (
				<div
					style={{
						position: "absolute",
						bottom: 60,
						right: 60,
						backgroundColor: "rgba(0,0,0,0.8)",
						padding: "16px 32px",
						borderRadius: 12,
						border: "2px solid #22c55e",
						boxShadow: "0 0 30px rgba(34, 197, 94, 0.5)",
						opacity: interpolate(
							frame,
							[updatesInstantly.startFrame + 8, updatesInstantly.startFrame + 14],
							[0, 1],
							{ extrapolateLeft: "clamp", extrapolateRight: "clamp" }
						),
					}}
				>
					<div
						style={{
							fontSize: 32,
							color: "#22c55e",
							fontWeight: "bold",
						}}
					>
						INSTANTLY UPDATED
					</div>
				</div>
			)}
		</AbsoluteFill>
	);
};

// Chat Bubble Component
const ChatBubble = ({
	text,
	opacity,
	scale,
	color,
}: {
	text: string;
	opacity: number;
	scale: number;
	color: string;
}) => (
	<div
		style={{
			backgroundColor: "white",
			color: "black",
			padding: "16px 32px",
			borderRadius: 24,
			fontSize: 36,
			fontWeight: "bold",
			opacity,
			transform: `scale(${scale})`,
			boxShadow: `0 10px 30px rgba(0,0,0,0.3), 0 0 20px ${color}40`,
			border: `2px solid ${color}`,
			transformOrigin: "left center",
		}}
	>
		{text}
	</div>
);
