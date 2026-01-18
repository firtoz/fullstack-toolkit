# Remotion Technical Guidelines

## ⚠️ CRITICAL: No CSS Transitions

**NEVER use CSS `transition` property in Remotion video components.**

In Remotion, all animations are frame-based. CSS transitions cause elements to lag behind their calculated positions because they animate over real time (e.g., 0.3s) rather than following frame-by-frame changes.

**Bad:**
```tsx
style={{
  top: calculatedPosition,
  transition: "all 0.3s ease", // WRONG - causes lag
}}
```

**Good:**
```tsx
style={{
  top: calculatedPosition,
  // No transition - position updates instantly each frame
}}
```

If you need smooth animations, use Remotion's `interpolate()` function with appropriate easing, not CSS transitions.

## Animation Synchronization

**When animating a cursor interacting with UI elements, the cursor and element MUST use the same easing function.**

If the cursor moves with `easeInOutCubic` but the element uses linear interpolation, they will visibly desync and the interaction will look broken.

**Bad:**
```tsx
// Cursor uses easeInOutCubic
const cursorY = interpolate(frame, [start, end], [startY, endY], {
  easing: easeInOutCubic,
});

// Element uses linear (default)
const elementValue = interpolate(frame, [start, end], [21, 19]);
```

**Good:**
```tsx
// Both use the same easing
const cursorY = interpolate(frame, [start, end], [startY, endY], {
  easing: easeInOutCubic,
});

const elementValue = interpolate(frame, [start, end], [21, 19], {
  easing: easeInOutCubic, // MUST match cursor!
});
```

## Instant UI Reactions

**Interactive elements should react INSTANTLY (same frame) to user actions, not with delays.**

When showing a click interaction, the visual state change should happen on the exact same frame as the click indicator appears.

**Bad:**
```tsx
// Click happens at frame 100
if (frame >= 100 && frame < 110) {
  isClicking = true;
}
// Value changes 5 frames later - feels laggy!
if (frame >= 105) {
  value = newValue;
}
```

**Good:**
```tsx
// Click happens at frame 100
if (frame >= 100 && frame < 110) {
  isClicking = true;
}
// Value changes instantly on same frame
if (frame >= 100) {
  value = newValue;
}
```

## Clean Looping Videos

**For seamless loops, avoid fade in/out animations at the start and end.**

Instead:
- Have content visible from frame 0
- Animate the cursor entering from off-screen at the start
- Animate the cursor exiting off-screen at the end
- Keep the loop point clean with no visual transitions

**Example:**
```tsx
// Cursor enters from off-screen
{ position: { x: -50, y: -50, frame: 0 } },
{ position: { x: 200, y: 400, frame: 15 } },

// ... interactions ...

// Cursor exits off-screen
{ position: { x: 2100, y: 1250, frame: endFrame } },
```

## Precise Layout Calculations

**ALWAYS measure your layout before implementing. Elements extending beyond the canvas is a critical error.**

**Before placing elements:**
1. Calculate total height/width needed (element sizes + spacing + margins)
2. Verify it fits within canvas dimensions (accounting for platform safe zones)
3. If it doesn't fit, adjust spacing or element sizes, don't just place them anyway
4. Document your measurements in comments for debugging

**When calculating cursor positions for interactions, account for ALL layout details:**

- Element padding and gaps
- `box-sizing: border-box` effects
- Border widths included in element dimensions
- `justifyContent`, `alignItems`, `marginTop: "auto"` effects
- Element radius/size offsets (e.g., knob radius when positioning on a track)

**Example - Calculating bounds correctly:**
```tsx
// WRONG: Orange fill goes to knob center
height: trackHeight - knobY

// RIGHT: Orange fill stops at knob bottom edge
height: trackHeight - knobY - knobRadius
```

**Example - Button positioning with flexbox:**
```tsx
// Container with justifyContent: "space-between" and marginTop: "auto" on label
// means button doesn't center vertically - it stays at top!
const buttonY = containerTop + padding + (buttonHeight / 2);
// NOT: containerTop + (containerHeight / 2)
```

## Visual Simplicity in UI Components

**When recreating UI components for video demos, keep them clean and minimal.**

Avoid unnecessary visual decorations:
- No background rectangles on selection indicators if text styling (bold, color) conveys the state
- No borders or outlines on buttons that should just show icons
- No hover/active backgrounds unless explicitly part of the design
- Use `<div>` instead of `<button>` to avoid browser default styling artifacts

**Example:**
```tsx
// WRONG: Unnecessary visual noise
<div style={{
  backgroundColor: isActive ? "rgba(249, 115, 22, 0.1)" : "#2a2a2a",
  border: isActive ? "2px solid #f97316" : "2px solid #444444",
}}>
  {/* selected item */}
</div>

// RIGHT: Let text styling indicate selection
<div style={{
  fontWeight: isCentered ? 700 : 400,
  color: isCentered ? "#ffffff" : "#666666",
}}>
  {/* selected item */}
</div>
```
