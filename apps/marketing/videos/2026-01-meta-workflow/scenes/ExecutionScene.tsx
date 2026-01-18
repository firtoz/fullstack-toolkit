import {
	AbsoluteFill,
	interpolate,
	useCurrentFrame,
	staticFile,
	Img,
} from "remotion";
import type { SceneProps } from "../../../shared/components/VideoComposition";
import { codeSnippets } from "../script";

export const ExecutionScene: React.FC<SceneProps> = ({ markers }) => {
	const frame = useCurrentFrame();

	const oneCommand = markers.oneCommand;
	const engineHandles = markers.engineHandles;
	const automatically = markers.automatically;

	// Terminal appearance
	const terminalOpacity = interpolate(
		frame,
		[oneCommand.startFrame, oneCommand.startFrame + 10],
		[0, 1],
		{ extrapolateLeft: "clamp" }
	);

	// Progress bars animation
	const progress = interpolate(
		frame,
		[engineHandles.startFrame, automatically.startFrame],
		[0, 100],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" }
	);

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
						background: "radial-gradient(circle at center, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.8) 100%)",
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
						transform: `translateY(${interpolate(frame, [oneCommand.startFrame, oneCommand.startFrame + 10], [20, 0], { extrapolateLeft: "clamp" })}px)`,
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
						<div style={{ width: 14, height: 14, borderRadius: "50%", background: "#ef4444" }} />
						<div style={{ width: 14, height: 14, borderRadius: "50%", background: "#eab308" }} />
						<div style={{ width: 14, height: 14, borderRadius: "50%", background: "#22c55e" }} />
						<div style={{ marginLeft: 16, color: "#64748b", fontSize: 14, fontFamily: "monospace" }}>
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
							<span style={{ color: "#f8fafc" }}>{codeSnippets.processCommand}</span>
						</div>

						{frame > engineHandles.startFrame && (
							<div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
								<ProgressBar 
									label="🎙️ Generating AI Voice" 
									progress={Math.min(100, progress * 1.5)} 
									color="#f472b6" 
								/>
								<ProgressBar 
									label="⏱️ Syncing Word Timing" 
									progress={Math.min(100, Math.max(0, progress * 1.5 - 20))} 
									color="#c084fc" 
								/>
								<ProgressBar 
									label="🎨 Building React Scenes" 
									progress={Math.min(100, Math.max(0, progress * 1.5 - 40))} 
									color="#60a5fa" 
								/>
								
								{frame > automatically.startFrame && (
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

const ProgressBar = ({ label, progress, color }: { label: string; progress: number; color: string }) => (
	<div style={{ opacity: progress > 0 ? 1 : 0.3, transition: "opacity 0.2s" }}>
		<div style={{ marginBottom: 10, fontSize: 18, color: "#94a3b8", display: "flex", justifyContent: "space-between" }}>
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
					transition: "width 0.1s linear",
				}}
			/>
		</div>
	</div>
);
