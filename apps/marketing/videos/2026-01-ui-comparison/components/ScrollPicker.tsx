interface ScrollPickerProps {
	/** Current temperature value (19-23) */
	value: number;
	/** Scroll offset for animation (0 = centered on value) */
	scrollOffset?: number;
}

/**
 * Option B: Scroll picker showing multiple values
 * No orange highlight - just subtle background change on selected item
 */
export const ScrollPicker: React.FC<ScrollPickerProps> = ({
	value,
	scrollOffset = 0,
}) => {
	const temps = [19, 20, 21, 22, 23];
	const itemHeight = 80;

	// Calculate base offset to center the selected value
	const selectedIndex = temps.indexOf(Math.round(value));
	const baseOffset = selectedIndex * itemHeight;

	// Calculate which item is actually in the center based on visual position
	const visualCenterIndex = (baseOffset - scrollOffset) / itemHeight;

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
			{/* Picker container with overflow */}
			<div
				style={{
					position: "relative",
					width: 200,
					height: 480,
					overflow: "hidden",
					borderRadius: 24,
					backgroundColor: "#1a1a1a",
					border: "2px solid #2a2a2a",
				}}
			>
				{/* No rectangle indicator - only text style indicates selection */}

				{/* Scrollable values */}
				<div
					style={{
						position: "absolute",
						top: "50%",
						left: 0,
						right: 0,
						transform: `translateY(${-baseOffset + scrollOffset - itemHeight / 2}px)`,
					}}
				>
					{temps.map((temp, index) => {
						// Calculate distance from visual center (based on scroll position)
						const distanceFromCenter = Math.abs(index - visualCenterIndex);

						// Calculate smooth scale and opacity based on distance
						const scale = Math.max(0.7, 1 - distanceFromCenter * 0.15);
						const opacity = Math.max(0.3, 1 - distanceFromCenter * 0.35);

						// Determine if item is in the center zone (selected)
						const isCentered = distanceFromCenter < 0.5;

						return (
							<div
								key={temp}
								style={{
									height: itemHeight,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									fontSize: 48 * scale,
									fontWeight: isCentered ? 700 : 400,
									color: isCentered ? "#ffffff" : "#666666",
									fontFamily: "'Inter', sans-serif",
									opacity,
								}}
							>
								{temp}°
							</div>
						);
					})}
				</div>

				{/* Gradient overlays for depth */}
				<div
					style={{
						position: "absolute",
						top: 0,
						left: 0,
						right: 0,
						height: 100,
						background:
							"linear-gradient(to bottom, #1a1a1a 0%, transparent 100%)",
						pointerEvents: "none",
					}}
				/>
				<div
					style={{
						position: "absolute",
						bottom: 0,
						left: 0,
						right: 0,
						height: 100,
						background: "linear-gradient(to top, #1a1a1a 0%, transparent 100%)",
						pointerEvents: "none",
					}}
				/>
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
				B
			</div>
		</div>
	);
};
