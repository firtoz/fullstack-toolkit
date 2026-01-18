import { interpolate } from "remotion";

interface SliderControlProps {
	/** Current temperature value (19-23) */
	value: number;
	/** Optional highlight state */
	isActive?: boolean;
}

/**
 * Option A: Vertical slider with draggable knob
 * Now includes a dark rounded rectangle "well" container like the reference
 */
export const SliderControl: React.FC<SliderControlProps> = ({
	value,
	isActive = false,
}) => {
	const minTemp = 19;
	const maxTemp = 23;
	const trackHeight = 320; // Shorter track so knob doesn't go too low
	const knobRadius = 18; // Half of 36px knob

	// Calculate knob position based on value (with bounds to keep knob on track)
	const normalizedValue = (value - minTemp) / (maxTemp - minTemp);
	const knobY = interpolate(
		normalizedValue,
		[0, 1],
		[trackHeight - knobRadius, knobRadius],
	);

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
			{/* Dark rounded well container - matches B and C */}
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					gap: 24,
					width: 200,
					height: 480,
					borderRadius: 24,
					backgroundColor: "#1a1a1a",
					border: "2px solid #2a2a2a",
					padding: "30px 0",
				}}
			>
				{/* Temperature display */}
				<div
					style={{
						fontSize: 64,
						fontWeight: 600,
						color: "#ffffff",
						fontFamily: "'Inter', sans-serif",
						lineHeight: 1,
					}}
				>
					{Math.round(value)}°
				</div>

				{/* Slider track and knob */}
				<div
					style={{
						position: "relative",
						width: 4,
						height: trackHeight,
						borderRadius: 2,
						backgroundColor: "#3a3a3a",
					}}
				>
					{/* Active track (filled portion) - stops at knob BOTTOM */}
					<div
						style={{
							position: "absolute",
							bottom: 0,
							left: 0,
							width: 4,
							height: Math.max(0, trackHeight - knobY - knobRadius),
							borderRadius: 2,
							backgroundColor: isActive ? "#f97316" : "#555555",
						}}
					/>

					{/* Knob */}
					<div
						style={{
							position: "absolute",
							top: knobY - knobRadius,
							left: "50%",
							transform: "translateX(-50%)",
							width: 36,
							height: 36,
							boxSizing: "border-box",
							borderRadius: "50%",
							backgroundColor: "#ffffff",
							border: isActive ? "3px solid #f97316" : "none",
							boxShadow: isActive
								? "0 0 0 4px rgba(249, 115, 22, 0.2), 0 4px 12px rgba(0,0,0,0.4)"
								: "0 2px 8px rgba(0,0,0,0.3)",
						}}
					/>
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
				A
			</div>
		</div>
	);
};
