import { AbsoluteFill, Img, staticFile } from "remotion";
import type { SceneProps } from "../../../shared/components/VideoComposition";
import {
	useFadeIn,
	useMarkerAnimation,
	useMarkerToMarker,
	useSlideIn,
} from "../../../shared/hooks/useMarkerAnimation";

export const ExecutionScene: React.FC<SceneProps> = ({ markers }) => {
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
			{/* Background Image */}
			<AbsoluteFill>
				<Img
					src={staticFile(
						"2026-01-meta-workflow-tiktok/images/execution-bg.png",
					)}
					style={{
						width: "100%",
						height: "100%",
						objectFit: "cover",
						opacity: 0.7,
					}}
				/>
				<div
					style={{
						position: "absolute",
						inset: 0,
						background:
							"radial-gradient(ellipse at center, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.5) 100%)",
					}}
				/>
			</AbsoluteFill>

			<AbsoluteFill
				style={{
					justifyContent: "center",
					alignItems: "center",
					// TikTok safe zones: top 15%, bottom 20%, sides 5%
					padding: "15% 5% 20% 5%",
				}}
			>
				<div
					style={{
						width: "100%",
						maxWidth: 900,
						opacity: terminalOpacity,
						transform: `translateY(${terminalY}px)`,
					}}
				>
					{/* Title */}
					<div
						style={{
							textAlign: "center",
							marginBottom: 40,
							backgroundColor: "rgba(0, 0, 0, 0.75)",
							padding: "24px 32px",
							borderRadius: 16,
							backdropFilter: "blur(10px)",
						}}
					>
						<div
							style={{
								fontSize: 38,
								fontWeight: "bold",
								color: "#f8fafc",
								marginBottom: 8,
							}}
						>
							AI Building Video...
						</div>
						<div
							style={{
								fontSize: 20,
								color: "#94a3b8",
							}}
						>
							Sit back and relax
						</div>
					</div>

					{/* Progress Bars Container */}
					<div
						style={{
							display: "flex",
							flexDirection: "column",
							gap: 26,
							backgroundColor: "rgba(15, 23, 42, 0.85)",
							padding: "32px",
							borderRadius: 20,
							border: "1px solid rgba(99, 102, 241, 0.2)",
							boxShadow: "0 0 60px rgba(99, 102, 241, 0.15)",
							backdropFilter: "blur(10px)",
							opacity: useMarkerAnimation(audioWord, {
								delay: -5,
								duration: 10,
							}),
						}}
					>
						<ProgressBar
							label="🎙️ Generating AI Voice"
							progress={audioProgress}
							color="#f472b6"
							startFrame={audioWord.startFrame}
						/>
						<ProgressBar
							label="⏱️ Syncing Word Timing"
							progress={timingProgress}
							color="#c084fc"
							startFrame={timingWord.startFrame}
						/>
						<ProgressBar
							label="🎨 Building React Scenes"
							progress={syncProgress}
							color="#60a5fa"
							startFrame={syncWord.startFrame}
						/>

						<div
							style={{
								color: "#4ade80",
								marginTop: 8,
								fontWeight: "bold",
								fontSize: 28,
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								gap: 12,
								opacity: useFadeIn(allAutomatic, 8),
								transform: `translateY(${useSlideIn(allAutomatic, {
									duration: 8,
									distance: 10,
								})}px)`,
							}}
						>
							<span style={{ fontSize: 32 }}>✅</span>
							Video ready in 2.3s
						</div>
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
	startFrame,
}: {
	label: string;
	progress: number;
	color: string;
	startFrame: number;
}) => {
	// Create a marker object for the hooks
	const marker = {
		id: `progress-${label}`,
		startFrame,
		endFrame: startFrame + 8,
		startTime: 0,
		endTime: 0,
	};
	const fadeOpacity = useFadeIn(marker, 8);
	const slideY = useSlideIn(marker, { duration: 8, distance: 10 });

	return (
		<div
			style={{
				opacity: fadeOpacity,
				transform: `translateY(${slideY}px)`,
			}}
		>
			<div
				style={{
					marginBottom: 10,
					fontSize: 19,
					color: "#94a3b8",
					display: "flex",
					justifyContent: "space-between",
					fontWeight: "500",
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
						boxShadow: `0 0 12px ${color}`,
					}}
				/>
			</div>
		</div>
	);
};
