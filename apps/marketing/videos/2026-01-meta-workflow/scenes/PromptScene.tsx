import {
	AbsoluteFill,
	Img,
	interpolate,
	staticFile,
	useCurrentFrame,
} from "remotion";
import type { SceneProps } from "../../../shared/components/VideoComposition";

export const PromptScene: React.FC<SceneProps> = ({ markers }) => {
	const frame = useCurrentFrame();

	// Get all markers
	const askAI = markers.askAI;
	const typeMake = markers.typeMake;
	const typeVideo = markers.typeVideo;
	const typeAbout = markers.typeAbout;
	const typeOur = markers.typeOur;
	const typeNew = markers.typeNew;
	const typeFeature = markers.typeFeature;
	const writesScript = markers.writesScript;

	// Build the typed text progressively based on markers
	const words = [
		{ marker: typeMake, text: "Make" },
		{ marker: typeVideo, text: " a video" },
		{ marker: typeAbout, text: " about" },
		{ marker: typeOur, text: " our" },
		{ marker: typeNew, text: " new" },
		{ marker: typeFeature, text: " feature" },
	];

	// Calculate what text is visible
	let visibleText = "";
	for (const word of words) {
		if (frame >= word.marker.startFrame) {
			visibleText += word.text;
		}
	}

	// Cursor blink
	const showCursor = frame % 20 < 10 && frame < writesScript.startFrame;

	// The magic moment: plain product transforms into polished marketing
	const transformProgress = interpolate(
		frame,
		[writesScript.startFrame, writesScript.startFrame + 15],
		[0, 1],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

	// Initial fade in
	const initialOpacity = interpolate(frame, [0, 10], [0, 1], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});

	// Zoom effect on transform
	const scale = interpolate(
		frame,
		[writesScript.startFrame, writesScript.startFrame + 20],
		[1, 1.05],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

	// AI badge appears when "ask Gemini or Opus" is said
	const aiBadgeOpacity = interpolate(
		frame,
		[askAI.startFrame, askAI.startFrame + 8],
		[0, 1],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

	return (
		<AbsoluteFill style={{ backgroundColor: "#000" }}>
			{/* The BEFORE State - plain dashboard */}
			<AbsoluteFill
				style={{
					opacity: initialOpacity * (1 - transformProgress),
					transform: `scale(${scale})`,
				}}
			>
				<Img
					src={staticFile("2026-01-meta-workflow/images/prompt-before.png")}
					style={{
						width: "100%",
						height: "100%",
						objectFit: "cover",
					}}
				/>
				{/* Overlay with the typing prompt */}
				<AbsoluteFill
					style={{
						justifyContent: "center",
						alignItems: "center",
					}}
				>
					<div
						style={{
							backgroundColor: "rgba(0,0,0,0.85)",
							padding: "40px 60px",
							borderRadius: 20,
							border: "1px solid #3b82f6",
							boxShadow: "0 0 40px rgba(59, 130, 246, 0.3)",
							minWidth: 600,
						}}
					>
						{/* AI Badge */}
						<div
							style={{
								fontSize: 24,
								color: "#a855f7",
								marginBottom: 16,
								opacity: aiBadgeOpacity,
								display: "flex",
								alignItems: "center",
								gap: 8,
							}}
						>
							Opus 4.5
						</div>

						{/* You type label */}
						<div style={{ fontSize: 24, color: "#64748b", marginBottom: 12 }}>
							You type:
						</div>

						{/* The typing text */}
						<div
							style={{
								fontSize: 44,
								color: "white",
								fontFamily: "monospace",
								minHeight: 60,
							}}
						>
							"{visibleText}
							<span
								style={{
									display: "inline-block",
									width: 3,
									height: 44,
									backgroundColor: "#3b82f6",
									marginLeft: 4,
									opacity: showCursor ? 1 : 0,
									verticalAlign: "middle",
								}}
							/>
							"
						</div>
					</div>
				</AbsoluteFill>
			</AbsoluteFill>

			{/* The AFTER State - polished marketing visual */}
			<AbsoluteFill
				style={{
					opacity: transformProgress,
					transform: `scale(${scale})`,
				}}
			>
				<Img
					src={staticFile("2026-01-meta-workflow/images/prompt-after.png")}
					style={{
						width: "100%",
						height: "100%",
						objectFit: "cover",
					}}
				/>
				{/* "AI generates" badge */}
				<div
					style={{
						position: "absolute",
						bottom: 60,
						left: "50%",
						transform: "translateX(-50%)",
						backgroundColor: "rgba(0,0,0,0.8)",
						padding: "20px 40px",
						borderRadius: 16,
						border: "2px solid #22c55e",
						boxShadow: "0 0 30px rgba(34, 197, 94, 0.4)",
					}}
				>
					<div
						style={{
							fontSize: 36,
							color: "#22c55e",
							fontWeight: "bold",
							display: "flex",
							alignItems: "center",
							gap: 12,
						}}
					>
						AI generates the script
					</div>
				</div>
			</AbsoluteFill>

			{/* Flash effect on transform */}
			{transformProgress > 0 && transformProgress < 1 && (
				<AbsoluteFill
					style={{
						backgroundColor: "white",
						opacity: interpolate(
							transformProgress,
							[0, 0.1, 0.3],
							[0, 0.8, 0],
							{ extrapolateRight: "clamp" },
						),
					}}
				/>
			)}
		</AbsoluteFill>
	);
};
