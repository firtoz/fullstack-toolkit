import { interpolate } from "remotion";
import { easeInOutCubic } from "../../../shared/lib/easings";

export interface CursorPosition {
	x: number;
	y: number;
	frame: number;
}

export interface CursorKeyframe {
	/** Target position */
	position: CursorPosition;
	/** Click animation at this position? */
	click?: boolean;
	/** Drag state (cursor holding down) */
	isDragging?: boolean;
}

interface AnimatedCursorProps {
	/** Current frame */
	frame: number;
	/** Array of keyframes defining cursor path */
	keyframes: CursorKeyframe[];
}

/**
 * Animated cursor component that moves smoothly between positions
 * with click and drag animations
 */
export const AnimatedCursor: React.FC<AnimatedCursorProps> = ({
	frame,
	keyframes,
}) => {
	if (keyframes.length === 0) {
		return null;
	}

	// Find current segment
	let currentSegment = 0;
	for (let i = 0; i < keyframes.length - 1; i++) {
		if (
			frame >= keyframes[i].position.frame &&
			frame < keyframes[i + 1].position.frame
		) {
			currentSegment = i;
			break;
		}
	}

	const startKeyframe = keyframes[currentSegment];
	const endKeyframe =
		keyframes[currentSegment + 1] || keyframes[currentSegment];

	// Interpolate position
	const x = interpolate(
		frame,
		[startKeyframe.position.frame, endKeyframe.position.frame],
		[startKeyframe.position.x, endKeyframe.position.x],
		{
			extrapolateLeft: "clamp",
			extrapolateRight: "clamp",
			easing: easeInOutCubic,
		},
	);

	const y = interpolate(
		frame,
		[startKeyframe.position.frame, endKeyframe.position.frame],
		[startKeyframe.position.y, endKeyframe.position.y],
		{
			extrapolateLeft: "clamp",
			extrapolateRight: "clamp",
			easing: easeInOutCubic,
		},
	);

	// Check if we're near a click keyframe
	let isClicking = false;
	const isDragging = startKeyframe.isDragging || false;

	for (const kf of keyframes) {
		if (kf.click) {
			// Click animation lasts 10 frames (5 down, 5 up)
			const clickStart = kf.position.frame;
			const clickEnd = clickStart + 10;
			if (frame >= clickStart && frame < clickEnd) {
				isClicking = true;
				break;
			}
		}
	}

	// Scale animation for click
	let scale = 1;
	if (isClicking) {
		// Find the exact click frame
		const clickKf = keyframes.find(
			(kf) =>
				kf.click &&
				frame >= kf.position.frame &&
				frame < kf.position.frame + 10,
		);
		if (clickKf) {
			const clickFrame = clickKf.position.frame;
			scale = interpolate(
				frame,
				[clickFrame, clickFrame + 5, clickFrame + 10],
				[1, 0.85, 1],
				{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
			);
		}
	}

	// Cursor appearance
	const cursorSize = 32;
	const cursorColor = isDragging ? "#f97316" : "#ffffff";

	// Offset so the tip (top-left) of the arrow is at the target position
	const tipOffsetX = 6;
	const tipOffsetY = 4;

	return (
		<div
			style={{
				position: "absolute",
				left: x - tipOffsetX,
				top: y - tipOffsetY,
				width: cursorSize,
				height: cursorSize,
				pointerEvents: "none",
				transform: `scale(${scale})`,
				transformOrigin: "top left",
			}}
		>
			{/* Cursor pointer (arrow) */}
			<svg
				width={cursorSize}
				height={cursorSize}
				viewBox="0 0 24 24"
				fill="none"
				style={{
					filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
				}}
			>
				<title>Cursor</title>
				<path
					d="M3 3L17 12L10 13L7 21L3 3Z"
					fill={cursorColor}
					stroke="#000000"
					strokeWidth="1.5"
				/>
			</svg>

			{/* Click ripple effect */}
			{isClicking && (
				<div
					style={{
						position: "absolute",
						top: tipOffsetY,
						left: tipOffsetX,
						width: 50,
						height: 50,
						marginLeft: -25,
						marginTop: -25,
						borderRadius: "50%",
						border: `3px solid ${cursorColor}`,
						opacity: interpolate(
							frame,
							[
								keyframes.find((kf) => kf.click && frame >= kf.position.frame)
									?.position.frame || 0,
								(keyframes.find((kf) => kf.click && frame >= kf.position.frame)
									?.position.frame || 0) + 10,
							],
							[0.8, 0],
							{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
						),
					}}
				/>
			)}
		</div>
	);
};
