# Video Development Workflow

## ⚠️ CRITICAL: Script Processing Must Come First

**Whenever you modify a `script.ts` file, you MUST run the processing command BEFORE creating or updating TSX scene files.**

### Why This Matters

The `script.ts` file defines:
- Narration text
- Scene markers (word timing points)
- Scene structure

Running the processing command generates:
- AI voiceover audio files
- Word-level timing transcriptions
- `timing.ts` with precise frame numbers for all markers

**The TSX scene files depend on these generated markers.** If you edit scenes without processing the script first, you'll be using stale/incorrect timing data.

### The Required Command

```bash
cd apps/marketing && bun run process-video <video-id> <voice> <preset>
```

**Example:**
```bash
cd apps/marketing && bun run process-video 2026-01-meta-workflow liam energetic
```

### Workflow Order

1. **Edit `script.ts`** - Update narration, markers, scene structure
2. **Run processing command** - Generate audio and timing data
3. **Edit scene TSX files** - Now you can safely use the new markers
4. **Preview** - `cd remotion-video && bun run dev`

### What Gets Cached

The processing system is smart about caching:
- ✅ Unchanged scenes reuse cached audio/transcriptions
- 🔄 Only modified scenes get regenerated
- This makes iterations fast

### Example Output

```
🔍 Checking cache status...
   ✅ hook: fully cached
   ✅ prompt: fully cached
   🔄 execution: regenerating markers  ← This scene was changed
   ✅ cta: fully cached
```

## Rule of Thumb

**Changed script.ts? Run process-video. Always.**

Don't try to manually update markers in `timing.ts` - let the tool regenerate them from the script.

## Sharing Audio Across Aspect Ratios

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

## Video Content Guidelines

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
