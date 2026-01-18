# Agent Instructions for Marketing Package

## Core Mindset: Think Like a Seasoned Marketing Expert

When working on this marketing package, **always evaluate from the perspective of a seasoned marketing professional**, not just a developer. Ask yourself:

- **Does this communicate real value?** Not "does it look cool?"
- **Would this make someone take action?** Not "is it technically impressive?"
- **Is the message clear and benefit-driven?** Not "does it use trendy aesthetics?"

## Marketing Quality Standards

### ❌ What NOT to Do

**Generic Fluff:**
- "Welcome to our product"
- "Our new tool makes development easier"
- "Try it today"
- Vague claims without specifics

**Superficial Improvements:**
- Adding purple/blue gradients to garbage content
- Slapping RGB lights on weak messaging
- Cyberpunk aesthetics for the sake of "looking cool"
- Flashy effects that distract from the message

**Off-Brand Content:**
- Stock imagery that doesn't relate to the actual product
- Generic business dashboards when talking about video creation
- Server rooms when showing a local script
- Any visuals that create cognitive dissonance with the narrative

### ✅ What TO Do

**Powerful, Benefit-Driven Copy:**
- "10x Your Shipping Speed"
- "Ship features in hours, not weeks"
- Quantifiable benefits
- Specific value propositions that make viewers think "holy shit, I need this"

**Substantive Transformations:**
- Show AI improving the **MESSAGE**, not just aesthetics
- Weak copy → Strong copy
- Generic → Specific
- Boring → Useful (not just pretty)

**On-Brand Imagery:**
- Show the actual workflow (AI chat, terminal commands, code)
- Visuals that support the narrative
- Realistic scale (local development, not NASA mission control)
- Professional but not gratuitous

## The "Seasoned Expert" Test

Before creating or approving any marketing asset, ask:

1. **"Would a marketing director approve this?"**
   - Or would they say "this is superficial" or "where's the value prop?"

2. **"Does this actually convert?"**
   - Does it make the viewer want to learn more?
   - Or is it just aesthetically pleasing but forgettable?

3. **"Is this on-message?"**
   - Does it support the core value proposition?
   - Or is it generic content that could be for any product?

4. **"Would I be embarrassed to show this to a client?"**
   - If yes, it needs work

## Video Development Workflow

### ⚠️ CRITICAL: Script Processing Must Come First

**Whenever you modify a `script.ts` file, you MUST run the processing command BEFORE creating or updating TSX scene files.**

#### Why This Matters

The `script.ts` file defines:
- Narration text
- Scene markers (word timing points)
- Scene structure

Running the processing command generates:
- AI voiceover audio files
- Word-level timing transcriptions
- `timing.ts` with precise frame numbers for all markers

**The TSX scene files depend on these generated markers.** If you edit scenes without processing the script first, you'll be using stale/incorrect timing data.

#### The Required Command

```bash
cd apps/marketing && bun run process-video <video-id> <voice> <preset>
```

**Example:**
```bash
cd apps/marketing && bun run process-video 2026-01-meta-workflow liam energetic
```

#### Workflow Order

1. **Edit `script.ts`** - Update narration, markers, scene structure
2. **Run processing command** - Generate audio and timing data
3. **Edit scene TSX files** - Now you can safely use the new markers
4. **Preview** - `cd remotion-video && bun run dev`

#### What Gets Cached

The processing system is smart about caching:
- ✅ Unchanged scenes reuse cached audio/transcriptions
- 🔄 Only modified scenes get regenerated
- This makes iterations fast

#### Example Output

```
🔍 Checking cache status...
   ✅ hook: fully cached
   ✅ prompt: fully cached
   🔄 execution: regenerating markers  ← This scene was changed
   ✅ cta: fully cached
```

### Rule of Thumb

**Changed script.ts? Run process-video. Always.**

Don't try to manually update markers in `timing.ts` - let the tool regenerate them from the script.

### Sharing Audio Across Aspect Ratios

**When creating multiple aspect ratio versions of the same video (e.g., 16:9 and 9:16), use `sharedAudioId` to avoid regenerating audio:**

```typescript
// In both script.ts files:
export const config: VideoConfig = {
  fps: 30,
  width: 1920,  // or 1080 for TikTok
  height: 1080, // or 1920 for TikTok
  sceneGap: 0.2,
  sharedAudioId: "2026-01-meta-workflow", // Same ID for both versions
};
```

**How it works:**
- Both videos specify the **same** `sharedAudioId`
- Audio files are stored in `remotion-video/public/{sharedAudioId}/audio/`
- Transcriptions are stored in `videos/{sharedAudioId}/transcriptions/`
- Cache manifest is shared in `videos/{sharedAudioId}/cache-manifest.json`
- Only one set of audio needs to be generated
- Both videos can have different layouts, images, and aspect ratios

**Requirements:**
- Both videos must have **identical scenes** (same IDs, same narration text)
- Markers can be different (for different layouts)
- Voice settings must be the same when running `process-video`

**Example:**
```bash
# Process the first video - generates audio
cd apps/marketing
bun run process-video 2026-01-meta-workflow liam energetic

# Process the second video - reuses audio, only resolves markers
bun run process-video 2026-01-meta-workflow-tiktok liam energetic
```

The second command will see the shared audio already exists and skip generation! 🎉

## Video Creation Guidelines

### Script Content
- **Tone:** Positive, respectful, enhancement-focused (never criticize competitors)
- **Copy:** Specific benefits over vague claims
- **Structure:** Clear value prop → How it works → Call to action
- **Language:** Professional but not corporate-speak

### Visuals
- Must support the actual workflow being described
- Should help viewers understand, not just look pretty
- Avoid clichés (endless purple gradients, generic tech stock photos)
- Show before/after transformations that demonstrate **real improvement in substance**

### Imagery Generation

#### ⚠️ CRITICAL: Actually Generate Images

**When a video needs images, you MUST generate them using the image generation script. Do NOT just write prompt files and leave them ungenerated.**

#### Image Generation Commands

**Mode 1: Direct prompt (creates both image and prompt.json):**
```bash
cd apps/marketing
bun run gen-image "your prompt here" remotion-video/public/<video-id>/images/image-name.png "16:9" "1K"
```

**Mode 2: From existing prompt.json (image only, no new JSON created):**
```bash
cd apps/marketing
bun run gen-image --json remotion-video/public/<video-id>/images/image-name.prompt.json remotion-video/public/<video-id>/images/image-name.png
```

**For multiple images:** Simply run the command multiple times with different file names. For example, when creating a TikTok video with 9 images, run the command 9 times with the appropriate prompt JSON files.

#### Workflow for Creating Videos with Images

1. **Write the script.ts** - Define narration and scene structure
2. **Identify needed images** - What visuals does each scene require?
3. **Create prompt.json files** (if creating a new video template) - Define image prompts with aspect ratio
4. **GENERATE THE IMAGES** - Run `gen-image` command for each image file needed (use `--json` flag to use existing prompt.json files)
5. **Run process-video** - Generate audio and timing data
6. **Create scene TSX files** - Use the generated images and markers
7. **Preview** - `cd remotion-video && bun run dev`

**Example for generating multiple images:**
```bash
cd apps/marketing
# Generate all 9 images for a TikTok video
bun run gen-image --json remotion-video/public/2026-01-meta-workflow-tiktok/images/hook-bg.prompt.json remotion-video/public/2026-01-meta-workflow-tiktok/images/hook-bg.png
bun run gen-image --json remotion-video/public/2026-01-meta-workflow-tiktok/images/prompt-before.prompt.json remotion-video/public/2026-01-meta-workflow-tiktok/images/prompt-before.png
# ... continue for each image
```

#### Image Quality Guidelines

When generating images with AI:
1. **Think substance first:** What message needs to be communicated?
2. **Be specific in prompts:** "Professional marketing copy showing quantifiable benefits" not "make it cool"
3. **Iterate with purpose:** Each version should improve the **message**, not just add effects
4. **Check the output critically:** Does it actually work from a marketing perspective?
5. **Regenerate if needed:** If an image doesn't work, refine the prompt and regenerate

#### Aspect Ratios

- **16:9** - Standard horizontal video (YouTube, Vimeo)
- **9:16** - Vertical video (TikTok, Instagram Reels, YouTube Shorts)
- **1:1** - Square (Instagram posts)

Always match the aspect ratio to your video format!

#### ⚠️ Platform Safe Zones

**When creating videos for social platforms, you MUST account for UI overlays that cover portions of the screen.**

### TikTok (9:16 Vertical)

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

### Instagram Reels (9:16 Vertical)

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

### YouTube Shorts (9:16 Vertical)

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

### YouTube (16:9 Horizontal)

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

### Universal Safe Zone Rules

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

## Common Pitfalls to Avoid

### "Pretty But Useless" Syndrome
- Adding gradients, glows, and effects without improving the core message
- Example: Transforming "Welcome to our product" → same text with purple background
- **Fix:** Transform the actual content → "10x Your Shipping Speed - Hours not weeks"

### "Off-Brand Generic Stock" Syndrome
- Using imagery that doesn't relate to the actual product/workflow
- Example: Showing business dashboards when talking about video creation tools
- **Fix:** Show the actual workflow (code editor with script, AI chat interface, terminal)

### "Hacker Aesthetic Overload" Syndrome
- Cyberpunk, RGB everything, circuit boards, data centers for simple local scripts
- It's overdone and doesn't differentiate
- **Fix:** Clean, professional, realistic representation of the actual tool

## Quality Bar

Every asset should score **8/10 or higher** on:
- **Relevance:** Does it support the core message?
- **Substance:** Does it communicate real value?
- **Professionalism:** Would a marketing expert approve?
- **Effectiveness:** Would it make someone take action?

If it scores below 8, it needs to be replaced or refined.

## Remember

**Gradients don't convert. Clear value propositions do.**

Your job isn't to make things "look cool" - it's to make marketing assets that actually work. Think ROI, not RGB.
