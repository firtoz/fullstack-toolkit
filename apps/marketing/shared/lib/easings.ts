/**
 * Common easing functions for Remotion animations
 *
 * Use these with interpolate()'s easing option to avoid
 * repeating inline easing function definitions.
 *
 * @example
 * ```ts
 * import { easeOutCubic } from '../lib/easings';
 *
 * const opacity = interpolate(frame, [0, 30], [0, 1], {
 *   easing: easeOutCubic
 * });
 * ```
 */

// ============================================================================
// CUBIC EASINGS
// ============================================================================

/**
 * Cubic ease-in: starts slow, ends fast
 * Acceleration curve
 */
export const easeInCubic = (t: number): number => t * t * t;

/**
 * Cubic ease-out: starts fast, ends slow
 * Deceleration curve (most common)
 */
export const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;

/**
 * Cubic ease-in-out: slow at both ends
 * S-curve for smooth transitions
 */
export const easeInOutCubic = (t: number): number =>
	t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

// ============================================================================
// QUADRATIC EASINGS
// ============================================================================

/**
 * Quadratic ease-in: gentler than cubic
 */
export const easeInQuad = (t: number): number => t * t;

/**
 * Quadratic ease-out: gentler deceleration
 */
export const easeOutQuad = (t: number): number => 1 - (1 - t) * (1 - t);

/**
 * Quadratic ease-in-out: gentle S-curve
 */
export const easeInOutQuad = (t: number): number =>
	t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;

// ============================================================================
// QUARTIC EASINGS (stronger curves)
// ============================================================================

/**
 * Quartic ease-in: very slow start
 */
export const easeInQuart = (t: number): number => t * t * t * t;

/**
 * Quartic ease-out: dramatic deceleration
 */
export const easeOutQuart = (t: number): number => 1 - (1 - t) ** 4;

/**
 * Quartic ease-in-out: dramatic S-curve
 */
export const easeInOutQuart = (t: number): number =>
	t < 0.5 ? 8 * t * t * t * t : 1 - (-2 * t + 2) ** 4 / 2;

// ============================================================================
// EXPONENTIAL EASINGS
// ============================================================================

/**
 * Exponential ease-in: extremely slow start
 */
export const easeInExpo = (t: number): number =>
	t === 0 ? 0 : 2 ** (10 * t - 10);

/**
 * Exponential ease-out: extremely fast deceleration
 * Great for "settling" animations
 */
export const easeOutExpo = (t: number): number =>
	t === 1 ? 1 : 1 - 2 ** (-10 * t);

/**
 * Exponential ease-in-out: extreme S-curve
 */
export const easeInOutExpo = (t: number): number =>
	t === 0
		? 0
		: t === 1
			? 1
			: t < 0.5
				? 2 ** (20 * t - 10) / 2
				: (2 - 2 ** (-20 * t + 10)) / 2;

// ============================================================================
// BACK EASINGS (overshoot/anticipation)
// ============================================================================

const c1 = 1.70158;
const c2 = c1 * 1.525;
const c3 = c1 + 1;

/**
 * Back ease-in: slight backward motion before moving forward
 * Great for anticipation effects
 */
export const easeInBack = (t: number): number => c3 * t * t * t - c1 * t * t;

/**
 * Back ease-out: overshoots then settles
 * Great for bouncy, playful animations
 */
export const easeOutBack = (t: number): number =>
	1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;

/**
 * Back ease-in-out: anticipation and overshoot
 */
export const easeInOutBack = (t: number): number =>
	t < 0.5
		? ((2 * t) ** 2 * ((c2 + 1) * 2 * t - c2)) / 2
		: ((2 * t - 2) ** 2 * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;

// ============================================================================
// CIRCULAR EASINGS
// ============================================================================

/**
 * Circular ease-in: gentle start, strong acceleration
 */
export const easeInCirc = (t: number): number => 1 - Math.sqrt(1 - t ** 2);

/**
 * Circular ease-out: strong deceleration
 */
export const easeOutCirc = (t: number): number => Math.sqrt(1 - (t - 1) ** 2);

/**
 * Circular ease-in-out: smooth circular curve
 */
export const easeInOutCirc = (t: number): number =>
	t < 0.5
		? (1 - Math.sqrt(1 - (2 * t) ** 2)) / 2
		: (Math.sqrt(1 - (-2 * t + 2) ** 2) + 1) / 2;

// ============================================================================
// LINEAR (no easing)
// ============================================================================

/**
 * Linear: constant speed, no easing
 */
export const linear = (t: number): number => t;
