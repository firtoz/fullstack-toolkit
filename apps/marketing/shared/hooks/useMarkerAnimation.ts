/**
 * Animation hooks for marker-driven animations in Remotion videos
 *
 * These hooks simplify common animation patterns by wrapping
 * Remotion's interpolate() with marker-aware timing.
 */

import { interpolate, useCurrentFrame } from "remotion";
import type { ResolvedMarker } from "../lib/video-types";

/**
 * Options for marker-based animations
 */
export interface AnimationOptions {
	/**
	 * Frames to wait after marker.startFrame before starting animation
	 * @default 0
	 */
	delay?: number;

	/**
	 * Duration of the animation in frames
	 * @default 8
	 */
	duration?: number;

	/**
	 * Starting value for the animation
	 * @default 0
	 */
	from?: number;

	/**
	 * Ending value for the animation
	 * @default 1
	 */
	to?: number;

	/**
	 * Easing function for the animation
	 * @example
	 * ```ts
	 * import { easeOutCubic } from '../lib/easings';
	 * const opacity = useMarkerAnimation(marker, { easing: easeOutCubic });
	 * ```
	 */
	easing?: (t: number) => number;
}

/**
 * Create an animation that starts at a specific marker
 *
 * @example
 * ```ts
 * // Fade in over 8 frames starting at marker
 * const opacity = useMarkerAnimation(markers.fadeIn);
 *
 * // Fade in with delay and custom duration
 * const opacity = useMarkerAnimation(markers.fadeIn, { delay: 5, duration: 15 });
 *
 * // Scale with easing
 * const scale = useMarkerAnimation(markers.grow, {
 *   from: 0.8,
 *   to: 1,
 *   easing: easeOutBack
 * });
 * ```
 */
export function useMarkerAnimation(
	marker: ResolvedMarker,
	options: AnimationOptions = {},
): number {
	const frame = useCurrentFrame();
	const { delay = 0, duration = 8, from = 0, to = 1, easing } = options;

	const start = marker.startFrame + delay;
	const end = start + duration;

	return interpolate(frame, [start, end], [from, to], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
		easing,
	});
}

/**
 * Convenience hook for fade-in animations
 *
 * @example
 * ```ts
 * const opacity = useFadeIn(markers.appear);
 * const opacity = useFadeIn(markers.appear, 12); // custom duration
 * ```
 */
export function useFadeIn(
	marker: ResolvedMarker,
	duration = 8,
	easing?: (t: number) => number,
): number {
	return useMarkerAnimation(marker, { duration, easing });
}

/**
 * Convenience hook for fade-out animations
 *
 * @example
 * ```ts
 * const opacity = useFadeOut(markers.disappear);
 * ```
 */
export function useFadeOut(
	marker: ResolvedMarker,
	duration = 8,
	easing?: (t: number) => number,
): number {
	return useMarkerAnimation(marker, { from: 1, to: 0, duration, easing });
}

/**
 * Options for appear-then-disappear animations
 */
export interface AppearDisappearOptions {
	/**
	 * Duration of the appear animation in frames
	 * @default 8
	 */
	appearDuration?: number;

	/**
	 * Duration of the disappear animation in frames
	 * @default 5
	 */
	disappearDuration?: number;

	/**
	 * Starting value
	 * @default 0
	 */
	from?: number;

	/**
	 * Peak value (fully visible)
	 * @default 1
	 */
	to?: number;
}

/**
 * Create an animation that appears, stays visible, then disappears
 *
 * This is a common pattern where an element fades in at one marker,
 * stays visible, then fades out at another marker.
 *
 * @example
 * ```ts
 * // Fade in at "code1", stay visible, fade out before "code2"
 * const opacity = useAppearDisappear(markers.code1, markers.code2);
 *
 * // Custom durations
 * const opacity = useAppearDisappear(markers.start, markers.end, {
 *   appearDuration: 12,
 *   disappearDuration: 8
 * });
 * ```
 */
export function useAppearDisappear(
	appearMarker: ResolvedMarker,
	disappearMarker: ResolvedMarker,
	options?: AppearDisappearOptions,
): number {
	const frame = useCurrentFrame();
	const {
		appearDuration = 8,
		disappearDuration = 5,
		from = 0,
		to = 1,
	} = options ?? {};

	return interpolate(
		frame,
		[
			appearMarker.startFrame,
			appearMarker.startFrame + appearDuration,
			disappearMarker.startFrame - disappearDuration,
			disappearMarker.startFrame,
		],
		[from, to, to, from],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);
}

/**
 * Create an animation between two markers
 *
 * The animation starts at the first marker and completes at the second marker.
 * Useful for progress bars, connections, or any animation that should span
 * multiple words/markers.
 *
 * @example
 * ```ts
 * // Progress bar that fills from "audio" to "all"
 * const progress = useMarkerToMarker(markers.audio, markers.all, { from: 0, to: 100 });
 * ```
 */
export function useMarkerToMarker(
	startMarker: ResolvedMarker,
	endMarker: ResolvedMarker,
	options?: { from?: number; to?: number; easing?: (t: number) => number },
): number {
	const frame = useCurrentFrame();
	const { from = 0, to = 1, easing } = options ?? {};

	return interpolate(
		frame,
		[startMarker.startFrame, endMarker.endFrame],
		[from, to],
		{
			extrapolateLeft: "clamp",
			extrapolateRight: "clamp",
			easing,
		},
	);
}

/**
 * Create a slide-in animation (translateX or translateY)
 *
 * @example
 * ```ts
 * const translateY = useSlideIn(markers.appear, { distance: -30 });
 * // Use in style: transform: `translateY(${translateY}px)`
 * ```
 */
export function useSlideIn(
	marker: ResolvedMarker,
	options?: {
		delay?: number;
		duration?: number;
		distance?: number;
		easing?: (t: number) => number;
	},
): number {
	const { distance = 30, ...animOptions } = options ?? {};
	return useMarkerAnimation(marker, {
		from: distance,
		to: 0,
		...animOptions,
	});
}

/**
 * Create a scale animation
 *
 * @example
 * ```ts
 * const scale = useScale(markers.grow);
 * // Use in style: transform: `scale(${scale})`
 * ```
 */
export function useScale(
	marker: ResolvedMarker,
	options?: {
		delay?: number;
		duration?: number;
		from?: number;
		to?: number;
		easing?: (t: number) => number;
	},
): number {
	const { from = 0.8, to = 1, ...animOptions } = options ?? {};
	return useMarkerAnimation(marker, { from, to, ...animOptions });
}
