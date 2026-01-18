# Platform Safe Zones

**When creating videos for social platforms, you MUST account for UI overlays that cover portions of the screen.**

## TikTok (9:16 Vertical)

**UI Overlays:**
- **Top 15%** - Caption text area
- **Bottom 20%** - Profile pic, like, comment, share buttons
- **Left/Right 5%** - Safety margins

**Implementation:**
```tsx
<AbsoluteFill
  style={{
    // TikTok safe zones
    padding: "15% 5% 20% 5%", // top, right, bottom, left
  }}
>
```

**For bottom-positioned elements:**
```tsx
style={{
  position: "absolute",
  bottom: "22%", // Above TikTok bottom UI (20% + 2% margin)
}}
```

## Instagram Reels (9:16 Vertical)

**UI Overlays:**
- **Top 12%** - Username, audio info
- **Bottom 25%** - Like, comment, share, audio scrubber
- **Left/Right 5%** - Safety margins

**Implementation:**
```tsx
<AbsoluteFill
  style={{
    padding: "12% 5% 25% 5%",
  }}
>
```

## YouTube Shorts (9:16 Vertical)

**UI Overlays:**
- **Top 10%** - Channel name, subscribe button
- **Bottom 22%** - Like, dislike, comment, share buttons
- **Left/Right 5%** - Safety margins

**Implementation:**
```tsx
<AbsoluteFill
  style={{
    padding: "10% 5% 22% 5%",
  }}
>
```

## YouTube (16:9 Horizontal)

**UI Overlays:**
- **Bottom 10%** - Video controls (play/pause, timeline, volume)
- **Top 8%** - Title overlay (when hovering)
- **Left/Right 3%** - Safety margins

**Implementation:**
```tsx
<AbsoluteFill
  style={{
    padding: "8% 3% 10% 3%",
  }}
>
```

## Universal Safe Zone Rules

**DO:**
- Keep critical content in the middle "safe" area
- Test with platform UI overlay mockups
- Add 2% extra margin beyond the minimum safe zone
- Use `position: absolute` with percentage-based positioning for badges/overlays

**DO NOT:**
- Place important text or logos in platform UI areas
- Use full-height/width split screens without safe zone accounting
- Assume the full canvas is visible to viewers
- Forget that different platforms have different UI layouts

**Testing Checklist:**
1. Preview with platform UI mockup overlays
2. Check that all text is readable
3. Verify CTAs and badges are visible
4. Ensure branding elements aren't covered
5. Test on actual mobile device if possible
