import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { easeInOutCubic } from "../../../shared/lib/easings";
import {
	AnimatedCursor,
	type CursorKeyframe,
} from "../../2026-01-ui-comparison/components/AnimatedCursor";
import { ScrollPicker } from "../../2026-01-ui-comparison/components/ScrollPicker";
import { SliderControl } from "../../2026-01-ui-comparison/components/SliderControl";
import { StepperControl } from "../../2026-01-ui-comparison/components/StepperControl";

interface MainSceneProps {
	durationInFrames: number;
}

/**
 * Main scene showing all three temperature controls with cursor interactions
 * TikTok vertical format (9:16): controls in horizontal row with safe zones applied
 */
export const MainScene: React.FC<MainSceneProps> = ({
	durationInFrames: _,
}) => {
	const frame = useCurrentFrame();

	// Timeline (no fade in/out for clean looping):
	// 0-60     (0-2s):    Cursor enters, moves to slider
	// 60-180   (2-6s):    Cursor demos Option A (slider drag)
	// 180-300  (6-10s):   Cursor demos Option B (scroll picker)
	// 300-420  (10-14s):  Cursor demos Option C (stepper clicks)
	// 420-480  (14-16s):  Cursor exits

	// No animations - everything visible from start for clean looping
	const titleOpacity = 1;
	const titleScale = 1;
	const controlsOpacity = 1;
	const controlsY = 0;
	const fadeOut = 1;

	// Control positions (horizontal row for TikTok)
	// Canvas: 1080×1920
	// TikTok safe zones: top 15% (288px), bottom 20% (384px), sides 5% (54px)

	const canvasWidth = 1080;
	const canvasHeight = 1920;
	const safeTop = canvasHeight * 0.15; // 288px
	// TikTok safe zones: left/right 5% (54px), bottom 20% (384px)
	// Safe area: width = 972px, height = 1248px

	const controlWidth = 260;
	const controlSpacing = 60; // Horizontal spacing between controls

	// Measure: Three controls at 260px with 60px spacing
	// Total width: 260*3 + 60*2 = 900px (fits in 972px safe width ✓)
	const totalWidth = controlWidth * 3 + controlSpacing * 2; // 900px
	const startX = (canvasWidth - totalWidth) / 2; // Center: (1080 - 900) / 2 = 90px

	// X positions (center of each control)
	const sliderX = startX + controlWidth / 2; // 90 + 130 = 220
	const pickerX = startX + controlWidth + controlSpacing + controlWidth / 2; // 540
	const stepperX =
		startX + (controlWidth + controlSpacing) * 2 + controlWidth / 2; // 860

	// Y position: vertically center controls in safe zone with title above
	const titleHeight = 100;
	const titleY = safeTop + 60; // 348px from top
	const controlsStartY = titleY + titleHeight + 80; // 528px
	const controlY = controlsStartY;
	// Control bottom: 528 + 600 = 1128px (well within 1536px safe bottom ✓)

	// Calculate Y positions of interactive elements within each control
	// All controls are 600px tall with 480px wells at the top

	// SliderControl: well(30px padding) + temp(64px) + gap(24px) + track(320px)
	// Track starts at: wellTop + 30 + 64 + 24 = 118px into the well
	const knobRadius = 18;
	const sliderTrackTop = controlY + 30 + 64 + 24; // 646
	const sliderKnobY_21 = sliderTrackTop + 160; // Middle of 320px track = 806
	const sliderKnobY_19 = sliderTrackTop + 320 - knobRadius; // Bottom bound = 948

	// ScrollPicker: well is 480px, center at 240
	const pickerCenterY = controlY + 240; // 768

	// StepperControl: well(480px) with 40px padding top/bottom
	// Up button center: 40 + 30 (half of 60px button) = 70px from well top
	// Down button center: 480 - 40 - 30 = 410px from well top
	const stepperUpY = controlY + 70; // 598
	const stepperDownY = controlY + 410; // 938

	// --- OPTION A: SLIDER INTERACTION ---
	const sliderStartFrame = 30; // Start earlier for snappier feel
	const sliderEndFrame = 150;
	const sliderActive = frame >= sliderStartFrame && frame < sliderEndFrame;

	// Slider value changes EXACTLY with cursor movement (same timing AND easing)
	// Click at frame 75, start drag at frame 76, finish drag at frame 130
	const sliderDragStart = sliderStartFrame + 16; // Frame 76 - right after click
	const sliderDragEnd = sliderStartFrame + 70; // Frame 130

	let sliderValue = 21;
	if (frame >= sliderDragStart && frame < sliderDragEnd) {
		sliderValue = interpolate(
			frame,
			[sliderDragStart, sliderDragEnd],
			[21, 19],
			{
				extrapolateLeft: "clamp",
				extrapolateRight: "clamp",
				easing: easeInOutCubic, // MUST match cursor easing!
			},
		);
	} else if (frame >= sliderDragEnd) {
		sliderValue = 19;
	}

	// --- OPTION B: SCROLL PICKER INTERACTION ---
	const pickerStartFrame = 150;

	// Scroll picker value and offset
	// We keep value=21 throughout the animation and use scrollOffset to move items
	// At the end, we snap to value=22 with offset=0 (same visual position)
	let pickerValue = 21;
	let pickerScrollOffset = 0;

	if (frame >= pickerStartFrame + 30 && frame < pickerStartFrame + 70) {
		// Drag: scroll items up by one position (value stays 21)
		pickerScrollOffset = interpolate(
			frame,
			[pickerStartFrame + 30, pickerStartFrame + 70],
			[0, -80],
			{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
		);
	} else if (frame >= pickerStartFrame + 70 && frame < pickerStartFrame + 85) {
		// Settle with slight overshoot then back (value still 21)
		// Using simple keyframes without problematic easing
		const settleProgress = (frame - (pickerStartFrame + 70)) / 15; // 0 to 1 over 15 frames
		// Damped spring-like settle: overshoot slightly then return
		const overshoot = Math.sin(settleProgress * Math.PI) * 8;
		pickerScrollOffset = -80 - overshoot;
	} else if (frame >= pickerStartFrame + 85) {
		// Snap to value 22 with offset 0
		// transform with value=21, offset=-80: -160 + (-80) - 40 = -280
		// transform with value=22, offset=0:  -240 + 0 - 40 = -280
		// Same visual position, no glitch!
		pickerScrollOffset = 0;
		pickerValue = 22;
	}

	// --- OPTION C: STEPPER INTERACTION ---
	const stepperStartFrame = 270;
	const stepperEndFrame = 390;
	const stepperActive = frame >= stepperStartFrame && frame < stepperEndFrame;

	// Stepper value and active button
	// Value changes INSTANTLY on the same frame as the click
	let stepperValue = 21;
	let stepperActiveButton: "up" | "down" | null = null;

	// First click: up button (21 -> 22) - value changes instantly on click frame
	if (frame >= stepperStartFrame + 20 && frame < stepperStartFrame + 30) {
		stepperActiveButton = "up";
	}
	if (frame >= stepperStartFrame + 20) {
		stepperValue = 22;
	}

	// Second click: up button again (22 -> 23) - value changes instantly
	if (frame >= stepperStartFrame + 50 && frame < stepperStartFrame + 60) {
		stepperActiveButton = "up";
	}
	if (frame >= stepperStartFrame + 50) {
		stepperValue = 23;
	}

	// Third click: down button (23 -> 22) - value changes instantly
	if (frame >= stepperStartFrame + 80 && frame < stepperStartFrame + 90) {
		stepperActiveButton = "down";
	}
	if (frame >= stepperStartFrame + 80) {
		stepperValue = 22;
	}

	// --- CURSOR ANIMATION ---
	const cursorKeyframes: CursorKeyframe[] = [
		// Enter from off-screen (top-left) - quick entry
		{ position: { x: -50, y: 400, frame: 0 } },
		// Animate into view quickly
		{ position: { x: 150, y: 700, frame: 15 } },

		// --- SLIDER INTERACTION ---
		// Move to slider knob (at 21° position)
		{
			position: { x: sliderX, y: sliderKnobY_21, frame: sliderStartFrame },
		},
		// Hover before click
		{
			position: { x: sliderX, y: sliderKnobY_21, frame: sliderStartFrame + 10 },
		},
		// Click on knob (frame 75)
		{
			position: { x: sliderX, y: sliderKnobY_21, frame: sliderStartFrame + 15 },
			click: true,
			isDragging: true,
		},
		// Start drag immediately after click (frame 76) - cursor stays at knob position
		{
			position: { x: sliderX, y: sliderKnobY_21, frame: sliderStartFrame + 16 },
			isDragging: true,
		},
		// Drag down to 19° (frame 130) - cursor and knob move together
		{
			position: { x: sliderX, y: sliderKnobY_19, frame: sliderStartFrame + 70 },
			isDragging: true,
		},
		// Release (frame 140)
		{
			position: { x: sliderX, y: sliderKnobY_19, frame: sliderStartFrame + 80 },
		},
		// Move right towards picker
		{
			position: {
				x: sliderX + 200,
				y: sliderKnobY_21,
				frame: sliderStartFrame + 100,
			},
		},

		// --- SCROLL PICKER INTERACTION ---
		// Move to picker center
		{
			position: { x: pickerX, y: pickerCenterY, frame: pickerStartFrame },
		},
		// Hover
		{
			position: {
				x: pickerX,
				y: pickerCenterY,
				frame: pickerStartFrame + 15,
			},
		},
		// Click and start drag
		{
			position: {
				x: pickerX,
				y: pickerCenterY,
				frame: pickerStartFrame + 20,
			},
			click: true,
			isDragging: true,
		},
		// Drag up (swipe gesture)
		{
			position: {
				x: pickerX,
				y: pickerCenterY - 100,
				frame: pickerStartFrame + 55,
			},
			isDragging: true,
		},
		// Release
		{
			position: {
				x: pickerX,
				y: pickerCenterY - 100,
				frame: pickerStartFrame + 65,
			},
		},
		// Move right towards stepper
		{
			position: {
				x: pickerX + 200,
				y: pickerCenterY,
				frame: pickerStartFrame + 90,
			},
		},

		// --- STEPPER INTERACTION ---
		// Move to up arrow
		{
			position: { x: stepperX, y: stepperUpY, frame: stepperStartFrame },
		},
		// First up click
		{
			position: {
				x: stepperX,
				y: stepperUpY,
				frame: stepperStartFrame + 20,
			},
			click: true,
		},
		// Pause
		{
			position: {
				x: stepperX,
				y: stepperUpY,
				frame: stepperStartFrame + 40,
			},
		},
		// Second up click
		{
			position: {
				x: stepperX,
				y: stepperUpY,
				frame: stepperStartFrame + 50,
			},
			click: true,
		},
		// Move to down arrow
		{
			position: {
				x: stepperX,
				y: stepperDownY,
				frame: stepperStartFrame + 70,
			},
		},
		// Down click
		{
			position: {
				x: stepperX,
				y: stepperDownY,
				frame: stepperStartFrame + 80,
			},
			click: true,
		},
		// Move away - exit to bottom right
		{
			position: {
				x: stepperX + 200,
				y: (stepperUpY + stepperDownY) / 2,
				frame: stepperStartFrame + 105,
			},
		},

		// Final position - exit far off-screen to bottom right
		{
			position: {
				x: 1200,
				y: 1200,
				frame: stepperEndFrame,
			},
		},
	];

	return (
		<AbsoluteFill
			style={{
				backgroundColor: "#111111",
				opacity: fadeOut,
			}}
		>
			{/* Title */}
			<div
				style={{
					position: "absolute",
					top: titleY,
					left: 0,
					right: 0,
					textAlign: "center",
					opacity: titleOpacity,
					transform: `scale(${titleScale})`,
				}}
			>
				<h1
					style={{
						fontSize: 64,
						fontWeight: 800,
						color: "#ffffff",
						fontFamily: "'Inter', sans-serif",
						margin: 0,
						padding: "0 40px",
					}}
				>
					Which is Better
				</h1>
			</div>

			{/* Controls container - horizontal row */}
			<div
				style={{
					position: "absolute",
					top: controlY,
					left: 0,
					right: 0,
					display: "flex",
					justifyContent: "center",
					alignItems: "flex-start",
					gap: controlSpacing,
					opacity: controlsOpacity,
					transform: `translateY(${controlsY}px)`,
				}}
			>
				{/* Option A: Slider */}
				<SliderControl value={sliderValue} isActive={sliderActive} />

				{/* Option B: Scroll Picker */}
				<ScrollPicker value={pickerValue} scrollOffset={pickerScrollOffset} />

				{/* Option C: Stepper */}
				<StepperControl
					value={stepperValue}
					activeButton={stepperActiveButton}
					isActive={stepperActive}
				/>
			</div>

			{/* Animated cursor - visible throughout for clean looping */}
			<AnimatedCursor frame={frame} keyframes={cursorKeyframes} />
		</AbsoluteFill>
	);
};
