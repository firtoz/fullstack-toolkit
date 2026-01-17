import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { CodeBlock } from "../../../remotion-video/src/components/CodeBlock";
import type { ResolvedMarker } from "../../../shared/lib/video-types";

interface Props {
	durationInFrames: number;
	markers: Record<string, ResolvedMarker>;
}

/**
 * Features Scene - features list with code → all connected diagram
 */
export const FeaturesScene: React.FC<Props> = ({
	durationInFrames,
	markers,
}) => {
	const frame = useCurrentFrame();

	// Get marker frames (all relative to scene start)
	const feature1Appear = markers.feature1Appear;
	const feature2Appear = markers.feature2Appear;
	const feature3Appear = markers.feature3Appear;
	const connectedDiagram = markers.connectedDiagram;

	// Feature list items - fade in as mentioned
	const feature1Opacity = interpolate(
		frame,
		[feature1Appear.startFrame + 1, feature1Appear.startFrame + 8],
		[0, 1],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

	const feature2Opacity = interpolate(
		frame,
		[feature2Appear.startFrame + 1, feature2Appear.startFrame + 8],
		[0, 1],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

	const feature3Opacity = interpolate(
		frame,
		[feature3Appear.startFrame + 1, feature3Appear.startFrame + 8],
		[0, 1],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

	// Code examples - each stays until next one appears
	const code1Opacity = interpolate(
		frame,
		[
			feature1Appear.startFrame + 2,
			feature1Appear.startFrame + 10,
			feature2Appear.startFrame - 5,
			feature2Appear.startFrame + 3,
		],
		[0, 1, 1, 0],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

	const code2Opacity = interpolate(
		frame,
		[
			feature2Appear.startFrame + 2,
			feature2Appear.startFrame + 10,
			feature3Appear.startFrame - 5,
			feature3Appear.startFrame + 3,
		],
		[0, 1, 1, 0],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

	const code3Opacity = interpolate(
		frame,
		[
			feature3Appear.startFrame + 2,
			feature3Appear.startFrame + 10,
			connectedDiagram.startFrame - 10,
			connectedDiagram.startFrame - 5,
		],
		[0, 1, 1, 0],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

	// Fade out features/code section before "all connected"
	const featuresOpacity = interpolate(
		frame,
		[connectedDiagram.startFrame - 8, connectedDiagram.startFrame],
		[1, 0],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

	// "All connected" diagram - starts at "all", stays until end
	const diagramOpacity = interpolate(
		frame,
		[
			connectedDiagram.startFrame,
			connectedDiagram.startFrame + 8,
			durationInFrames,
		],
		[0, 1, 1],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

	// Connection animation progress - animates during "all connected"
	const connectionProgress = interpolate(
		frame,
		[connectedDiagram.startFrame, connectedDiagram.endFrame],
		[0, 1],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

	return (
		<AbsoluteFill
			style={{
				justifyContent: "center",
				alignItems: "center",
			}}
		>
			{/* Feature list (left 30%) and code examples (right 60%) */}
			<div
				style={{
					position: "absolute",
					display: "flex",
					width: "100%",
					height: "100%",
					alignItems: "center",
					padding: "0 5%",
					gap: "10%",
					opacity: featuresOpacity,
				}}
			>
				{/* Left: Feature list */}
				<div
					style={{
						width: "30%",
						display: "flex",
						flexDirection: "column",
						gap: 32,
					}}
				>
					<FeatureItem
						icon="📥"
						name="useDynamicFetcher"
						description="Load data with full type inference"
						opacity={feature1Opacity}
						color="#3b82f6"
					/>
					<FeatureItem
						icon="📤"
						name="useDynamicSubmitter"
						description="Submit forms with type safety"
						opacity={feature2Opacity}
						color="#8b5cf6"
					/>
					<FeatureItem
						icon="⚡"
						name="formAction"
						description="Zod validation built-in"
						opacity={feature3Opacity}
						color="#a855f7"
					/>
				</div>

				{/* Right: Code examples */}
				<div style={{ width: "60%", position: "relative" }}>
					{/* Code 1: useDynamicFetcher */}
					<div
						style={{
							position: "absolute",
							width: "100%",
							opacity: code1Opacity,
						}}
					>
						<CodeBlock
							language="typescript"
							fontSize={16}
							code={`// Type-safe data fetching
const fetcher = useDynamicFetcher<
  typeof import("./api.users")
>("/api/users/:id", { id: userId });

// ✨ Fully typed!
fetcher.data?.user.displayName
fetcher.data?.user.email

// Auto-complete works everywhere
fetcher.load({ page: "1" });`}
						/>
					</div>

					{/* Code 2: useDynamicSubmitter */}
					<div
						style={{
							position: "absolute",
							width: "100%",
							opacity: code2Opacity,
						}}
					>
						<CodeBlock
							language="typescript"
							fontSize={16}
							code={`// Type-safe form submission
const submitter = useDynamicSubmitter<
  typeof import("./auth.login")
>("/auth/login");

// ✨ Schema-validated & typed!
await submitter.submitJson({
  email: "user@example.com",
  password: "secret123",
});

// Or use Form component
<submitter.Form>...</submitter.Form>`}
						/>
					</div>

					{/* Code 3: formAction */}
					<div
						style={{
							position: "absolute",
							width: "100%",
							opacity: code3Opacity,
						}}
					>
						<CodeBlock
							language="typescript"
							fontSize={16}
							code={`// Define once, use everywhere
export const action = formAction({
  schema: z.object({
    email: z.string().email(),
    password: z.string().min(8),
  }),
  handler: async (args, data) => {
    // ✨ data is fully typed!
    const user = await login(
      data.email,    // string
      data.password  // string
    );
    return success({ user });
  },
});`}
						/>
					</div>
				</div>
			</div>

			{/* "All connected" diagram */}
			<div
				style={{
					position: "absolute",
					width: "100%",
					height: "100%",
					display: "flex",
					justifyContent: "center",
					alignItems: "center",
					opacity: diagramOpacity,
				}}
			>
				<ConnectionDiagram progress={connectionProgress} />
			</div>

			{/* "All connected" text */}
			<div
				style={{
					position: "absolute",
					bottom: 80,
					opacity: diagramOpacity,
					transform: `scale(${0.9 + diagramOpacity * 0.1})`,
				}}
			>
				<span
					style={{
						fontSize: 40,
						fontWeight: 700,
						color: "#22c55e",
						fontFamily: "'Inter', sans-serif",
						textShadow:
							"0 0 20px rgba(34, 197, 94, 0.5), 0 0 40px rgba(34, 197, 94, 0.3)",
					}}
				>
					All connected ✨
				</span>
			</div>
		</AbsoluteFill>
	);
};

const FeatureItem: React.FC<{
	icon: string;
	name: string;
	description: string;
	opacity: number;
	color: string;
}> = ({ icon, name, description, opacity, color }) => (
	<div
		style={{
			opacity,
			transform: `translateX(${(1 - opacity) * -30}px)`,
			transition: "none",
		}}
	>
		<div
			style={{
				background: `linear-gradient(135deg, ${color}20 0%, ${color}10 100%)`,
				border: `2px solid ${color}60`,
				borderRadius: 16,
				padding: 24,
			}}
		>
			<div style={{ fontSize: 40, marginBottom: 8 }}>{icon}</div>
			<div
				style={{
					fontSize: 24,
					fontWeight: 700,
					color: "#fff",
					marginBottom: 8,
					fontFamily: "'Inter', sans-serif",
				}}
			>
				{name}
			</div>
			<div
				style={{
					fontSize: 16,
					color: "rgba(255, 255, 255, 0.7)",
					fontFamily: "'Inter', sans-serif",
				}}
			>
				{description}
			</div>
		</div>
	</div>
);

const ConnectionDiagram: React.FC<{ progress: number }> = ({ progress }) => {
	return (
		<div
			style={{
				position: "relative",
				width: 900,
				height: 600,
			}}
		>
			{/* Central route page (source) */}
			<div
				style={{
					position: "absolute",
					top: "50%",
					left: "50%",
					transform: "translate(-50%, -50%)",
					background: "linear-gradient(135deg, #f97316 0%, #fb923c 100%)",
					border: "3px solid #fff",
					borderRadius: 20,
					padding: 32,
					width: 200,
					boxShadow:
						"0 0 40px rgba(249, 115, 22, 0.6), 0 20px 60px rgba(0, 0, 0, 0.4)",
					zIndex: 10,
				}}
			>
				<div style={{ fontSize: 32, textAlign: "center", marginBottom: 8 }}>
					📄
				</div>
				<div
					style={{
						fontSize: 20,
						fontWeight: 700,
						color: "#fff",
						textAlign: "center",
						fontFamily: "'Inter', sans-serif",
					}}
				>
					/auth/login
				</div>
				<div
					style={{
						fontSize: 14,
						color: "rgba(255, 255, 255, 0.9)",
						textAlign: "center",
						marginTop: 8,
						fontFamily: "'Inter', sans-serif",
					}}
				>
					formAction
				</div>
			</div>

			{/* Connected pages */}
			<ConnectedPage
				x={100}
				y={80}
				icon="📥"
				label="/dashboard"
				sublabel="useDynamicFetcher"
				color="#3b82f6"
				progress={progress}
				delay={0}
			/>
			<ConnectedPage
				x={600}
				y={80}
				icon="📤"
				label="/profile"
				sublabel="useDynamicSubmitter"
				color="#8b5cf6"
				progress={progress}
				delay={0.25}
			/>
			<ConnectedPage
				x={100}
				y={420}
				icon="📥"
				label="/users"
				sublabel="useDynamicFetcher"
				color="#3b82f6"
				progress={progress}
				delay={0.5}
			/>
			<ConnectedPage
				x={600}
				y={420}
				icon="📤"
				label="/settings"
				sublabel="useDynamicSubmitter"
				color="#8b5cf6"
				progress={progress}
				delay={0.75}
			/>

			{/* Connection lines - FROM outside TO center */}
			<svg
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					width: "100%",
					height: "100%",
					pointerEvents: "none",
				}}
				aria-label="Connection lines"
			>
				<title>Connection lines between route and pages</title>
				{/* Line FROM top left TO center */}
				<line
					x1="200"
					y1="150"
					x2={200 + 250 * Math.max(0, Math.min((progress - 0) * 4, 1))}
					y2={150 + 150 * Math.max(0, Math.min((progress - 0) * 4, 1))}
					stroke="#22c55e"
					strokeWidth="3"
					strokeDasharray="8,4"
					opacity={Math.max(0, Math.min(progress * 4, 1))}
				/>

				{/* Line FROM top right TO center */}
				<line
					x1="600"
					y1="150"
					x2={600 - 150 * Math.max(0, Math.min((progress - 0.25) * 4, 1))}
					y2={150 + 150 * Math.max(0, Math.min((progress - 0.25) * 4, 1))}
					stroke="#22c55e"
					strokeWidth="3"
					strokeDasharray="8,4"
					opacity={Math.max(0, Math.min((progress - 0.25) * 4, 1))}
				/>

				{/* Line FROM bottom left TO center */}
				<line
					x1="200"
					y1="450"
					x2={200 + 250 * Math.max(0, Math.min((progress - 0.5) * 4, 1))}
					y2={450 - 150 * Math.max(0, Math.min((progress - 0.5) * 4, 1))}
					stroke="#22c55e"
					strokeWidth="3"
					strokeDasharray="8,4"
					opacity={Math.max(0, Math.min((progress - 0.5) * 4, 1))}
				/>

				{/* Line FROM bottom right TO center */}
				<line
					x1="600"
					y1="450"
					x2={600 - 150 * Math.max(0, Math.min((progress - 0.75) * 4, 1))}
					y2={450 - 150 * Math.max(0, Math.min((progress - 0.75) * 4, 1))}
					stroke="#22c55e"
					strokeWidth="3"
					strokeDasharray="8,4"
					opacity={Math.max(0, Math.min((progress - 0.75) * 4, 1))}
				/>
			</svg>
		</div>
	);
};

const ConnectedPage: React.FC<{
	x: number;
	y: number;
	icon: string;
	label: string;
	sublabel: string;
	color: string;
	progress: number;
	delay: number;
}> = ({ x, y, icon, label, sublabel, color, progress, delay }) => {
	const opacity = Math.max(0, Math.min((progress - delay) * 4, 1));

	return (
		<div
			style={{
				position: "absolute",
				left: x,
				top: y,
				background: `linear-gradient(135deg, ${color}30 0%, ${color}15 100%)`,
				border: `2px solid ${color}`,
				borderRadius: 12,
				padding: 16,
				width: 140,
				opacity,
				transform: `scale(${0.8 + opacity * 0.2})`,
				boxShadow: `0 0 20px ${color}40`,
			}}
		>
			<div style={{ fontSize: 24, textAlign: "center", marginBottom: 4 }}>
				{icon}
			</div>
			<div
				style={{
					fontSize: 14,
					fontWeight: 600,
					color: "#fff",
					textAlign: "center",
					fontFamily: "'Inter', sans-serif",
				}}
			>
				{label}
			</div>
			<div
				style={{
					fontSize: 11,
					color: "rgba(255, 255, 255, 0.7)",
					textAlign: "center",
					marginTop: 4,
					fontFamily: "'Inter', sans-serif",
				}}
			>
				{sublabel}
			</div>
		</div>
	);
};
