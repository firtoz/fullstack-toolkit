import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import type { SceneProps } from "../../../shared/components/VideoComposition";
import {
	useFadeIn,
	useMarkerToMarker,
	useSlideIn,
} from "../../../shared/hooks/useMarkerAnimation";
import { codeSnippets } from "../script";

export const ExecutionScene: React.FC<SceneProps> = ({ markers }) => {
	const frame = useCurrentFrame();

	const engineTakesOver = markers.engineTakesOver;
	const audioWord = markers.audioWord;
	const timingWord = markers.timingWord;
	const syncWord = markers.syncWord;
	const allWord = markers.allWord;
	const allAutomatic = markers.allAutomatic;

	// Terminal appearance
	const terminalOpacity = useFadeIn(engineTakesOver, 10);
	const terminalY = useSlideIn(engineTakesOver, { duration: 10, distance: 20 });

	// Individual progress bars - each starts with its word, all finish at "all" word end
	const audioProgress = useMarkerToMarker(audioWord, allWord, {
		from: 0,
		to: 100,
	});
	const timingProgress = useMarkerToMarker(timingWord, allWord, {
		from: 0,
		to: 100,
	});
	const syncProgress = useMarkerToMarker(syncWord, allWord, {
		from: 0,
		to: 100,
	});

	return (
		<AbsoluteFill style={{ backgroundColor: "#000" }}>
			{/* Server Room Background */}
			<AbsoluteFill>
				<Img
					src={staticFile("2026-01-meta-workflow/images/execution-bg.png")}
					style={{
						width: "100%",
						height: "100%",
						objectFit: "cover",
						opacity: 0.4,
					}}
				/>
				<div
					style={{
						position: "absolute",
						inset: 0,
						background:
							"radial-gradient(circle at center, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.8) 100%)",
					}}
				/>
			</AbsoluteFill>

			<AbsoluteFill
				style={{
					justifyContent: "center",
					alignItems: "center",
				}}
			>
				<div
					style={{
						width: "80%",
						maxWidth: 1200,
						backgroundColor: "rgba(15, 23, 42, 0.95)",
						borderRadius: 16,
						border: "1px solid #334155",
						overflow: "hidden",
						opacity: terminalOpacity,
						boxShadow: "0 0 80px rgba(99, 102, 241, 0.2)",
						transform: `translateY(${terminalY}px)`,
					}}
				>
					{/* Terminal Header */}
					<div
						style={{
							height: 44,
							backgroundColor: "#1e293b",
							display: "flex",
							alignItems: "center",
							padding: "0 16px",
							gap: 8,
							borderBottom: "1px solid #334155",
						}}
					>
						<div
							style={{
								width: 14,
								height: 14,
								borderRadius: "50%",
								background: "#ef4444",
							}}
						/>
						<div
							style={{
								width: 14,
								height: 14,
								borderRadius: "50%",
								background: "#eab308",
							}}
						/>
						<div
							style={{
								width: 14,
								height: 14,
								borderRadius: "50%",
								background: "#22c55e",
							}}
						/>
						<div
							style={{
								marginLeft: 16,
								color: "#64748b",
								fontSize: 14,
								fontFamily: "monospace",
							}}
						>
							Terminal — bun run process-video
						</div>
					</div>

					{/* Terminal Content */}
					<div
						style={{
							padding: 32,
							fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
							fontSize: 22,
							color: "#e2e8f0",
							minHeight: 380,
						}}
					>
						<div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
							<span style={{ color: "#22c55e" }}>❯</span>
							<span style={{ color: "#94a3b8" }}>~/project</span>
							<span style={{ color: "#f8fafc" }}>
								{codeSnippets.processCommand}
							</span>
						</div>

						{frame > audioWord.startFrame && (
							<div
								style={{ display: "flex", flexDirection: "column", gap: 20 }}
							>
								<ProgressBar
									label="🎙️ Generating AI Voice"
									progress={audioProgress}
									color="#f472b6"
								/>
								{frame > timingWord.startFrame && (
									<ProgressBar
										label="⏱️ Syncing Word Timing"
										progress={timingProgress}
										color="#c084fc"
									/>
								)}
								{frame > syncWord.startFrame && (
									<ProgressBar
										label="🎨 Building React Scenes"
										progress={syncProgress}
										color="#60a5fa"
									/>
								)}

								{frame > allAutomatic.startFrame && (
									<div
										style={{
											color: "#4ade80",
											marginTop: 20,
											fontWeight: "bold",
											fontSize: 26,
											display: "flex",
											alignItems: "center",
											gap: 12,
										}}
									>
										<span style={{ fontSize: 32 }}>✅</span>
										Video ready in 2.3s
									</div>
								)}
							</div>
						)}
					</div>
				</div>
			</AbsoluteFill>
		</AbsoluteFill>
	);
};

const ProgressBar = ({
	label,
	progress,
	color,
}: {
	label: string;
	progress: number;
	color: string;
}) => (
	<div style={{ opacity: progress > 0 ? 1 : 0.3 }}>
		<div
			style={{
				marginBottom: 10,
				fontSize: 18,
				color: "#94a3b8",
				display: "flex",
				justifyContent: "space-between",
			}}
		>
			<span>{label}</span>
			<span style={{ color: progress >= 100 ? "#4ade80" : "#64748b" }}>
				{progress >= 100 ? "Done" : `${Math.round(progress)}%`}
			</span>
		</div>
		<div
			style={{
				width: "100%",
				height: 10,
				backgroundColor: "#1e293b",
				borderRadius: 5,
				overflow: "hidden",
			}}
		>
			<div
				style={{
					width: `${progress}%`,
					height: "100%",
					backgroundColor: color,
					borderRadius: 5,
					boxShadow: `0 0 10px ${color}`,
				}}
			/>
		</div>
	</div>
);
