import {
	AbsoluteFill,
	Img,
	interpolate,
	staticFile,
	useCurrentFrame,
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
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

	// "Just ask" pulse effect
	const justAskPulse = interpolate(
		frame,
		[justAsk.startFrame, justAsk.startFrame + 10, justAsk.startFrame + 20],
		[1, 1.1, 1],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

	// "Sexy" bubble and effect
	const sexyBubbleOpacity = interpolate(
		frame,
		[makeSexy.startFrame, makeSexy.startFrame + 6],
		[0, 1],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

	// "Cool" bubble and effect
	const coolBubbleOpacity = interpolate(
		frame,
		[makeCool.startFrame, makeCool.startFrame + 6],
		[0, 1],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

	// Progressive transformation based on each step
	// We have 5 states: before -> flashier -> sexy -> cool -> after
	// Each transition happens when the respective word is spoken

	// Transition 1: "before" fades out when "just ask" is spoken
	const beforeOpacity = interpolate(
		frame,
		[justAsk.startFrame, justAsk.startFrame + 8],
		[1, 0],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

	// Transition 2: "flashier" fades in when "just ask" starts, fades out when "sexy" is spoken
	const flashierOpacity = interpolate(
		frame,
		[
			justAsk.startFrame,
			justAsk.startFrame + 8,
			makeSexy.startFrame,
			makeSexy.startFrame + 8,
		],
		[0, 1, 1, 0],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

	// Transition 3: "sexy" fades in when word is spoken, fades out when "cool" is spoken
	const sexyOpacity = interpolate(
		frame,
		[
			makeSexy.startFrame,
			makeSexy.startFrame + 8,
			makeCool.startFrame,
			makeCool.startFrame + 8,
		],
		[0, 1, 1, 0],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

	// Transition 4: "cool" fades in when word is spoken and stays visible
	const coolOpacity = interpolate(
		frame,
		[makeCool.startFrame, makeCool.startFrame + 8],
		[0, 1],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

	// Calculate overall progress for effects (0 to 1)
	const overallProgress = interpolate(
		frame,
		[justAsk.startFrame, makeCool.startFrame + 8],
		[0, 1],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

	return (
		<AbsoluteFill style={{ backgroundColor: "#000" }}>
			{/* State 1: BEFORE - plain/boring */}
			<AbsoluteFill
				style={{
					opacity: beforeOpacity,
				}}
			>
				<Img
					src={staticFile(
						"2026-01-meta-workflow-tiktok/images/refine-before.png",
					)}
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

			{/* State 2: FLASHIER - energetic/vibrant */}
			<AbsoluteFill
				style={{
					opacity: flashierOpacity,
				}}
			>
				<Img
					src={staticFile(
						"2026-01-meta-workflow-tiktok/images/refine-flashier.png",
					)}
					style={{
						width: "100%",
						height: "100%",
						objectFit: "cover",
					}}
				/>
			</AbsoluteFill>

			{/* State 3: SEXY - provocative/flashy */}
			<AbsoluteFill
				style={{
					opacity: sexyOpacity,
				}}
			>
				<Img
					src={staticFile(
						"2026-01-meta-workflow-tiktok/images/refine-sexy.png",
					)}
					style={{
						width: "100%",
						height: "100%",
						objectFit: "cover",
					}}
				/>
			</AbsoluteFill>

			{/* State 4: COOL - sleek/minimalist (final state) */}
			<AbsoluteFill
				style={{
					opacity: coolOpacity,
				}}
			>
				<Img
					src={staticFile(
						"2026-01-meta-workflow-tiktok/images/refine-cool.png",
					)}
					style={{
						width: "100%",
						height: "100%",
						objectFit: "cover",
					}}
				/>
			</AbsoluteFill>

			{/* Chat Bubbles Container - stack vertically along left side for TikTok */}
			<AbsoluteFill
				style={{
					justifyContent: "flex-start",
					alignItems: "flex-start",
					// TikTok safe zones: top 15%, bottom 20%, left 5%
					padding: "16% 5% 22% 6%",
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
			{overallProgress > 0 && overallProgress < 1 && (
				<AbsoluteFill
					style={{
						background: `linear-gradient(45deg, 
							rgba(236, 72, 153, ${overallProgress * 0.3}), 
							rgba(139, 92, 246, ${overallProgress * 0.3}),
							rgba(6, 182, 212, ${overallProgress * 0.3})
						)`,
						mixBlendMode: "overlay",
					}}
				/>
			)}

			{/* "INSTANTLY UPDATED" badge - centered vertically */}
			{frame >= updatesInstantly.startFrame && (
				<div
					style={{
						position: "absolute",
						top: "50%", // Center vertically
						left: "50%",
						transform: "translate(-50%, -50%)",
						background:
							"linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)",
						padding: "24px 40px",
						borderRadius: 16,
						border: "2px solid rgba(100,116,139,0.2)",
						boxShadow:
							"0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)",
						backdropFilter: "blur(10px)",
						opacity: interpolate(
							frame,
							[updatesInstantly.startFrame, updatesInstantly.startFrame + 8],
							[0, 1],
							{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
						),
						scale: interpolate(
							frame,
							[updatesInstantly.startFrame, updatesInstantly.startFrame + 10],
							[0.9, 1],
							{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
						),
						maxWidth: "85%",
					}}
				>
					<div
						style={{
							fontSize: 32,
							color: "#1e293b",
							fontWeight: "600",
							letterSpacing: "-0.5px",
						}}
					>
						✓ Instantly Updated
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
			padding: "16px 28px",
			borderRadius: 24,
			fontSize: 32,
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
