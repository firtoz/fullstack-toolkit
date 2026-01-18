interface StepperControlProps {
	/** Current temperature value (19-23) */
	value: number;
	/** Which button is being pressed ('up' | 'down' | null) */
	activeButton?: "up" | "down" | null;
	/** Optional highlight state */
	isActive?: boolean;
}

/**
 * Option C: Stepper with up/down arrows
 * Full height container, no dividers, clean chevron arrows
 */
export const StepperControl: React.FC<StepperControlProps> = ({
	value,
	activeButton = null,
	isActive = false,
}) => {
	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				width: 260,
				height: 600,
			}}
		>
			{/* Stepper container - full height, no dividers */}
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "space-between",
					width: 200,
					height: 480,
					borderRadius: 24,
					backgroundColor: "#1a1a1a",
					border: "2px solid #2a2a2a",
					padding: "40px 0",
				}}
			>
				{/* Up arrow - just the chevron */}
				<div
					style={{
						width: 80,
						height: 60,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<svg
						width="32"
						height="32"
						viewBox="0 0 24 24"
						fill="none"
						style={{
							opacity: activeButton === "up" ? 1 : 0.4,
						}}
					>
						<title>Increase temperature</title>
						<path
							d="M6 15L12 9L18 15"
							stroke={activeButton === "up" && isActive ? "#f97316" : "#ffffff"}
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				</div>

				{/* Temperature display - centered */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						fontSize: 72,
						fontWeight: 600,
						color: "#ffffff",
						fontFamily: "'Inter', sans-serif",
					}}
				>
					{Math.round(value)}°
				</div>

				{/* Down arrow - just the chevron */}
				<div
					style={{
						width: 80,
						height: 60,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<svg
						width="32"
						height="32"
						viewBox="0 0 24 24"
						fill="none"
						style={{
							opacity: activeButton === "down" ? 1 : 0.4,
						}}
					>
						<title>Decrease temperature</title>
						<path
							d="M6 9L12 15L18 9"
							stroke={
								activeButton === "down" && isActive ? "#f97316" : "#ffffff"
							}
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				</div>
			</div>

			{/* Label - greyish text with margin */}
			<div
				style={{
					width: 56,
					height: 56,
					borderRadius: "50%",
					backgroundColor: "#ffffff",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					fontSize: 28,
					fontWeight: 700,
					color: "#666666",
					fontFamily: "'Inter', sans-serif",
					marginTop: 40,
				}}
			>
				C
			</div>
		</div>
	);
};
