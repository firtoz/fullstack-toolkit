# Video Production Playbook

This guide describes how to create marketing videos for router-toolkit using Remotion and ElevenLabs.

## Quick Start (AI Workflow)

**For Claude Opus 4.5 / Sonnet 4.5:**

1. **Start Plan Mode** in Cursor with Opus 4.5
2. **Provide prompt**: "Make a video explaining [TOPIC] using the marketing package playbook as a guide"
3. **AI generates** `script.ts` in `videos/YYYY-MM-topic/`
4. **Run command**:
   ```bash
   cd apps/marketing
   bun run process-video YYYY-MM-topic liam energetic
   ```
5. **AI reviews** `timing.ts` output and builds scene components
6. **AI creates** `Composition.tsx` using shared `VideoComposition` component
7. **Preview**: `cd remotion-video && bun run dev`
8. **Render**: `bunx remotion render src/index.ts YYYY-MM-topic out/video.mp4`

**Key Command:**
```bash
bun run process-video <video-id> <voice> <preset> [speed] [--force]
```

Example: `bun run process-video 2026-01-dx-focus liam energetic 1.2`

---

## Overview

The video production process follows these steps:

1. **Discuss** - Understand what video to create
2. **Script** - Write declarative narration, markers, and scene definitions
3. **Process** - Automated audio generation, transcription, validation (with retry)
4. **Scenes** - Build Remotion scenes synced to markers
5. **Render** - Preview and export final video

## Directory Structure

```
marketing/
├── PLAYBOOK.md                     # This file
├── .env                            # ELEVENLABS_API_KEY
├── package.json                    # Scripts: bun process-video
├── shared/
│   ├── lib/
│   │   └── video-types.ts          # TypeScript types (runtime)
│   └── scripts/
│       ├── process-video.ts        # Automated pipeline (build-time)
│       └── marker-resolver.ts      # Marker validation/resolution
├── videos/
│   └── YYYY-MM-topic/              # One folder per video
│       ├── script.ts               # Declarative scene definitions with markers
│       ├── timing.ts               # Auto-generated timing data
│       ├── Composition.tsx         # Video composition
│       ├── audio/                  # Per-scene audio files
│       │   ├── hook.mp3
│       │   ├── problem.mp3
│       │   └── ...
│       ├── transcriptions/         # Per-scene transcriptions (gitignored)
│       ├── attempts/               # Failed validation attempts (gitignored)
│       └── scenes/                 # Scene components
│           ├── HookScene.tsx
│           └── ...
└── remotion-video/
    ├── src/
    │   ├── Root.tsx                # Registers all video compositions
    │   └── components/
    │       └── CodeBlock.tsx       # Shared components
    └── public/
        └── YYYY-MM-topic/
            └── audio/              # Audio files for Remotion
```

---

## Step 1: Discuss the Video Concept

Before writing anything, clarify the following with the user:

### Questions to Ask

1. **Purpose**: What is this video for?
   - Feature announcement
   - General introduction
   - Tutorial/how-to
   - Social media promo

2. **Target Audience**: Who is watching?
   - Developers new to router-toolkit
   - Existing users learning new features
   - React Router users evaluating options

3. **Key Messages**: What 2-3 things must viewers remember?
   - Example: "Type-safe forms", "Dynamic fetchers", "Zero config"

4. **Tone**: What feeling should it convey?
   - Professional/technical
   - Casual/friendly
   - Energetic/exciting

5. **Duration**: How long should it be?
   - Short (15-30s) - Social media
   - Medium (30-60s) - Feature overview
   - Long (1-2min) - Tutorial

### Video Naming Convention

Videos are named by date and topic: `YYYY-MM-topic`

Examples:
- `2026-01-intro` - January 2026 introduction video
- `2026-01-dx-focus` - January 2026 DX-focused video
- `2026-02-v5.3-features` - February 2026 v5.3 feature announcement

---

## Step 2: Write the Script

Create `marketing/videos/YYYY-MM-topic/script.ts`:

### Tone Guidelines - IMPORTANT

**Be positive and respectful.** router-toolkit enhances React Router - it doesn't replace or criticize it.

**DO:**
- "React Router is great. router-toolkit makes it even better."
- "What if it could be even easier?"
- "Build even faster."
- "Take your workflow to the next level."

**DON'T:**
- "React Router is hard to use." (insulting)
- "Is building with it easy?" (implying it's not)
- "So much boilerplate." (too negative)
- "Finally, a solution." (implies others failed)

**Framing:**
- Position as "enhancement" not "fix"
- Acknowledge existing tools are good
- Show how router-toolkit adds value on top
- Be excited, not frustrated

### Script Structure

```typescript
import type { Scene, VideoConfig } from "../../shared/lib/video-types";

export const VIDEO_ID = "2026-01-dx-focus";

// Video configuration
export const config: VideoConfig = {
  fps: 30,
  width: 1920,
  height: 1080,
  sceneGap: 0.3, // seconds between scenes - easily tweakable!
};

// Scene definitions with declarative markers
export const scenes: Scene[] = [
  {
    id: "hook",
    narration: "React Router is great. But what if it could be even easier?",
    visual: "React Router logo with checkmark, then lightbulb moment",
    markers: [
      {
        // Highlight "great" when spoken
        id: "greatHighlight",
        start: { type: 'wordStart', word: 'great' },
        end: { type: 'wordEnd', word: 'great' },
      },
      {
        // Highlight "even easier" when spoken
        id: "evenEasierHighlight",
        start: { type: 'wordStart', word: 'even' },
        end: { type: 'wordEnd', word: 'easier' },
      },
      {
        // Second line appears when "what" is spoken
        id: "secondLineAppear",
        start: { type: 'wordStart', word: 'what' },
        end: { type: 'wordStart', word: 'what' }, // single point marker
      },
    ],
  },
  {
    id: "problem",
    narration: "Fetchers. Submission state. Form actions. A lot to wire up.",
    visual: "Show list of concepts",
    markers: [
      {
        id: "fetchersAppear",
        start: { type: 'wordStart', word: 'fetchers' },
        end: { type: 'wordEnd', word: 'fetchers' },
      },
      {
        id: "submissionAppear",
        start: { type: 'wordStart', word: 'submission' },
        end: { type: 'wordEnd', word: 'state' },
      },
      // ... more markers
    ],
  },
  // ... more scenes
];

// Code snippets used in the video
export const codeSnippets = {
  example1: `const data = await fetcher.load();`,
  example2: `submitter.submit({ email, password });`,
  installCommand: "bun add @firtoz/router-toolkit",
};
```

### Marker Types

Markers define **when** visual events happen, tied to the narration:

```typescript
type TimingRef = 
  | { type: 'wordStart'; word: string; occurrence?: number; offset?: number }
  | { type: 'wordEnd'; word: string; occurrence?: number; offset?: number }
  | { type: 'sceneStart'; offset?: number }
  | { type: 'sceneEnd'; offset?: number };
```

**Examples:**
- Highlight word: `start: { type: 'wordStart', word: 'great' }`
- Range: `start: { type: 'wordStart', word: 'even' }, end: { type: 'wordEnd', word: 'easier' }`
- With offset: `start: { type: 'wordStart', word: 'hello', offset: 0.2 }` (0.2s after word starts)
- Nth occurrence: `start: { type: 'wordStart', word: 'use', occurrence: 2 }` (second "use")

### Narration Guidelines

- **Keep it concise**: Aim for 2-4 words per second
- **Use short sentences**: Easier to sync and sounds more natural
- **Avoid jargon**: Unless your audience expects it
- **Include pauses**: Use periods to create natural breaks
- **Be marker-aware**: Words you reference in markers must appear in narration
- **Stay positive**: Enhance, don't criticize

### Common Marker Patterns

```typescript
// Highlight a single word
{
  id: "highlight",
  start: { type: 'wordStart', word: 'great' },
  end: { type: 'wordEnd', word: 'great' },
}

// Highlight a phrase
{
  id: "phraseHighlight",
  start: { type: 'wordStart', word: 'even' },
  end: { type: 'wordEnd', word: 'easier' },
}

// Element appears at specific word
{
  id: "elementAppear",
  start: { type: 'wordStart', word: 'what' },
  end: { type: 'wordStart', word: 'what' }, // instant, not a range
}

// Entire scene duration
{
  id: "backgroundAnimation",
  start: { type: 'sceneStart' },
  end: { type: 'sceneEnd' },
}
```

---

## Step 3: Process Video (Automated)

The `process-video` script handles everything:
- Generates per-scene audio with ElevenLabs
- Transcribes each scene for word-level timing
- Validates all markers exist in transcription
- Auto-retries up to 3 times if validation fails
- Saves failed attempts for manual review
- Generates `timing.ts` with resolved marker times
- Smart caching: skips scenes if script hasn't changed

### Command

```bash
cd marketing
bun process-video <video-id> [voice] [preset] [speed] [--force]
```

**Arguments:**
- `video-id` - Video folder name (required)
- `voice` - Voice name (default: liam)
- `preset` - professional, energetic, calm (default: energetic)
- `speed` - Speech speed 0.5-2.0 (default: 1.0)
- `--force` - Force regenerate all scenes (skip cache)

**Examples:**
```bash
# Process with defaults (uses cache if script unchanged)
bun process-video 2026-01-dx-focus

# Faster pace for marketing
bun process-video 2026-01-dx-focus liam energetic 1.2

# Force regenerate all
bun process-video 2026-01-dx-focus --force
```

### Speed Settings

| Speed | Use Case |
|-------|----------|
| 1.0 | Normal pace (default) |
| 1.1 | Slightly faster, good for marketing |
| 1.2 | Fast-paced, energetic, social media |
| 1.3 | Very fast, only for short punchy videos |

**Recommended:** Use `1.2` for marketing videos to keep energy high.

### Voice Options

Available voices (all good for developer content):
- **liam** - Clear, professional, energetic (default, best)
- **chris** - Warm, conversational
- **adam** - Deep, authoritative
- **brian**, **daniel**, **alice**, etc.

### Smart Caching

The script tracks input hashes (narration + markers) per scene:
- **Script unchanged?** → Skips scene, uses cached audio/transcription
- **Script changed?** → Regenerates only that scene
- **Validation failed?** → Auto-retries up to 3 times
- **All retries failed?** → Saves attempts to `attempts/` folder for review

Cache manifest stored in: `marketing/videos/YYYY-MM-topic/cache-manifest.json`

### Output Files

**Generated per scene:**
- `audio/hook.mp3`, `audio/problem.mp3`, etc. - Per-scene audio
- `transcriptions/hook.json` - Word-level transcription (gitignored)
- `attempts/hook-attempt-1/` - Failed validation attempts (gitignored)

**Generated once:**
- `timing.ts` - Resolved markers with frame numbers

**Copied for Remotion:**
- `remotion-video/public/YYYY-MM-topic/audio/*.mp3`

### Example `timing.ts` (Auto-generated)

```typescript
export const FPS = 30;

export const sceneTimings: SceneTimingInfo[] = [
  {
    id: "hook",
    audioFile: "hook.mp3",
    audioDuration: 2.62,
    durationFrames: 79,
    markers: {
      greatHighlight: {
        id: "greatHighlight",
        startTime: 0.899,
        endTime: 1.779,
        startFrame: 27,
        endFrame: 53,
      },
      evenEasierHighlight: {
        id: "evenEasierHighlight",
        startTime: 2.819,
        endTime: 3.739,
        startFrame: 85,
        endFrame: 112,
      },
      // ... more markers
    },
  },
  // ... more scenes
];
```

---

## Step 4: Build Scenes

Create Remotion scene components in `marketing/videos/YYYY-MM-topic/scenes/`.

### Scene Component Interface

All scenes receive:
```typescript
interface SceneProps {
  durationInFrames: number;
  markers: Record<string, ResolvedMarker>;
}

interface ResolvedMarker {
  id: string;
  startTime: number;
  endTime: number;
  startFrame: number;
  endFrame: number;
}
```

**No more manual frame calculations!** All timing comes from markers.

### Scene Component Template

```tsx
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { ResolvedMarker } from "../../../shared/lib/video-types";

interface Props {
  durationInFrames: number;
  markers: Record<string, ResolvedMarker>;
}

export const HookScene: React.FC<Props> = ({ durationInFrames, markers }) => {
  const frame = useCurrentFrame();

  // Get markers (all timing is already resolved to frames)
  const greatHighlight = markers.greatHighlight;
  const evenEasierHighlight = markers.evenEasierHighlight;
  const secondLineAppear = markers.secondLineAppear;

  // Instant highlights (no delay) - use frame comparison
  const isGreatHighlighted = frame >= greatHighlight.startFrame;
  const isEasierHighlighted = frame >= evenEasierHighlight.startFrame;

  // Fade-in animations - add small delay + fade duration
  const line2Opacity = interpolate(
    frame,
    [secondLineAppear.startFrame + 1, secondLineAppear.startFrame + 9],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div style={{ fontSize: 64, textAlign: "center" }}>
        {/* Line 1: highlight "great" when marker active */}
        <div>
          React Router is{" "}
          <span style={{ color: isGreatHighlighted ? "#22c55e" : "white" }}>
            great
          </span>
          .
        </div>

        {/* Line 2: fade in at marker, highlight "even easier" */}
        <div style={{ opacity: line2Opacity }}>
          But what if it could be{" "}
          <span style={{ color: isEasierHighlighted ? "#f97316" : "white" }}>
            even easier
          </span>
          ?
        </div>
      </div>
    </AbsoluteFill>
  );
};
```

### Timing Principles

1. **Highlights = Instant (no delay)**
   - Use: `frame >= marker.startFrame`
   - For: Color changes, glows, text emphasis

2. **New Elements = Small Delay + Fade**
   - Use: `interpolate(frame, [marker.startFrame + 1, marker.startFrame + 9], [0, 1])`
   - For: New text blocks, cards, icons

3. **Animations = Tied to Marker Range**
   - Use marker duration: `interpolate(frame, [marker.startFrame, marker.endFrame], ...)`
   - For: Progress bars, connection lines, diagrams

### Animation Patterns

**Fade in/out:**
```tsx
const opacity = interpolate(
  frame,
  [startFrame + 1, startFrame + 8],
  [0, 1],
  { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
);
```

**Spring entrance:**
```tsx
const scale = spring({ frame, fps: FPS, config: { damping: 12 } });
```

**Progress/animation during marker:**
```tsx
const progress = interpolate(
  frame,
  [marker.startFrame, marker.endFrame],
  [0, 1],
  { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
);
```

**Staggered list items:**
```tsx
// Each item has its own marker
const item1Opacity = interpolate(
  frame,
  [markers.item1.startFrame + 1, markers.item1.startFrame + 8],
  [0, 1],
  { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
);

const item2Opacity = interpolate(
  frame,
  [markers.item2.startFrame + 1, markers.item2.startFrame + 8],
  [0, 1],
  { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
);
```

### Shared Components

**MermaidDiagram** - For rendering flowcharts and diagrams:

```tsx
import { MermaidDiagram } from "../../../remotion-video/src/components/MermaidDiagram";

// In your scene component
<MermaidDiagram
  chart={`
    graph TD
      A[Start] --> B[Process]
      B --> C[End]
  `}
  scale={0.8}
/>
```

**CodeBlock** - For syntax-highlighted code:

```tsx
import { CodeBlock } from "../../../remotion-video/src/components/CodeBlock";

<CodeBlock
  code={codeSnippets.example}
  language="typescript"
  fontSize={18}
/>
```

### Main Composition

Create `marketing/videos/YYYY-MM-topic/Composition.tsx` using the shared `VideoComposition`:

```tsx
import type React from "react";
import {
  VideoComposition,
  createCompositionConfig,
  type SceneProps,
} from "../../shared/components/VideoComposition";
import { HookScene } from "./scenes/HookScene";
import { ProblemScene } from "./scenes/ProblemScene";
// ... import other scenes
import { config, VIDEO_ID } from "./script";
import { sceneTimings } from "./timing";

// Map scene IDs to their components
const sceneComponents: Record<string, React.FC<SceneProps>> = {
  hook: HookScene,
  problem: ProblemScene,
  // ... register all scenes
};

/**
 * Video composition - uses shared VideoComposition component
 */
export const MyVideo: React.FC = () => {
  return (
    <VideoComposition
      videoId={VIDEO_ID}
      config={config}
      sceneTimings={sceneTimings}
      sceneComponents={sceneComponents}
      backgroundColor="#0a0a0f"
      backgroundGradient="radial-gradient(ellipse at 50% 0%, rgba(249, 115, 22, 0.1) 0%, transparent 50%)"
    />
  );
};

// Export composition config
export const myVideoComposition = createCompositionConfig(
  VIDEO_ID,
  config,
  sceneTimings,
  MyVideo,
);
```

**Benefits of shared VideoComposition:**
- Consistent scene sequencing logic across all videos
- Automatic audio prefetching
- Configurable gaps and styling
- Less boilerplate code

### Register in Root.tsx

Update `marketing/remotion-video/src/Root.tsx`:

```tsx
import { Composition } from "remotion";
import { DxFocusVideo, dxFocusComposition } from "../../videos/2026-01-dx-focus/Composition";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id={dxFocusComposition.id}
        component={dxFocusComposition.component}
        durationInFrames={dxFocusComposition.durationInFrames}
        fps={dxFocusComposition.fps}
        width={dxFocusComposition.width}
        height={dxFocusComposition.height}
      />
    </>
  );
};
```

---

## Step 5: Preview and Render

### Development Preview

```bash
cd marketing/remotion-video
bun run dev
```

Opens browser at `http://localhost:3000`. Select your video from the composition list.

### Checking Timing Sync

1. Play video at normal speed
2. Visuals should appear right when words are spoken (thanks to markers!)
3. Scrub frame-by-frame if needed (`←` `→` keys)

### Render Final Video

```bash
cd marketing/remotion-video
bunx remotion render src/index.ts YYYY-MM-topic out/YYYY-MM-topic.mp4
```

Options:
- `--quality=100` - Maximum quality
- `--codec=h264` - Standard MP4 codec

### Quick Iteration Workflow

1. Edit `script.ts` (change narration or markers)
2. Run `bun process-video YYYY-MM-topic` (only regenerates changed scenes)
3. Edit scene components
4. Remotion hot-reloads automatically
5. Render when satisfied

---

## Checklist for New Videos

- [ ] Create video folder: `marketing/videos/YYYY-MM-topic/`
- [ ] Write `script.ts` with config, scenes, narration, and markers
- [ ] **Check tone is positive** (enhance, don't criticize)
- [ ] Run `bun process-video YYYY-MM-topic` (audio + transcription + validation)
- [ ] Create scene components in `scenes/` (use markers for timing)
- [ ] Create `Composition.tsx` (accumulator pattern for timeline)
- [ ] Register in `remotion-video/src/Root.tsx`
- [ ] Preview with `bun run dev`
- [ ] Verify timing sync at normal playback speed
- [ ] Render final video

---

## Troubleshooting

### Audio not syncing with visuals

- **Markers resolve automatically** - if sync is off, check:
  1. Did you run `process-video` after changing script?
  2. Are you using `markers.X.startFrame` correctly?
  3. Did validation pass? Check console output.

### Validation failures

- **Word not found**: ElevenLabs might pronounce differently (e.g., "type safe" vs "type-safe")
  - Check `transcriptions/scene.json` to see actual words
  - Update marker to match transcription
  - Or regenerate with `--force`

- **End before start**: Marker word order doesn't match narration
  - Fix: Ensure marker words appear in correct order in narration

### Scene feels rushed/slow

- **Adjust speed**: Regenerate with different speed (e.g., `1.0` for slower, `1.3` for faster)
- **Or adjust sceneGap**: Change `config.sceneGap` in script.ts (e.g., `0.5` for more breathing room)

### Marker word doesn't exist

Check failed attempt in `attempts/scene-attempt-1/`:
- `transcription.json` - See actual transcribed words
- `errors.txt` - Validation errors
- `audio.mp3` - Listen to generated audio

Common issues:
- Punctuation: "great" vs "great!" (markers are punctuation-lenient)
- Hyphenation: "type safe" → "type-safe" (update marker word)
- Pronunciation variations (rare with ElevenLabs)

### Cache not working

- Force regenerate: `bun process-video YYYY-MM-topic --force`
- Delete cache: `rm marketing/videos/YYYY-MM-topic/cache-manifest.json`

### Images cropped or wrong aspect ratio

If images are cropped or not in the correct format for video (16:9), regenerate them:

```bash
# 1. Regenerate with correct aspect ratio using -1 suffix
cd marketing
bun run gen-image "your prompt here" remotion-video/public/YYYY-MM-topic/images/scene-bg-1.png "16:9"

# 2. Review the new image, if approved replace the old one:
cd remotion-video/public/YYYY-MM-topic/images/
rm scene-bg.png scene-bg.prompt.json
mv scene-bg-1.png scene-bg.png
mv scene-bg-1.prompt.json scene-bg.prompt.json

# 3. Repeat for all images that need regeneration
```

**Why this workflow:**
- The `-1` suffix prevents overwriting existing images
- Compare old vs new before committing
- `.prompt.json` files track generation parameters for reproducibility
- Easy iteration: try `-2`, `-3`, etc. until satisfied

**Image generation tips:**
- Always specify `"16:9"` aspect ratio for video backgrounds
- Use `"1:1"` for logos or square images
- Resolution defaults to `1K` (good for most cases), use `2K` or `4K` for higher quality
- Check the `.prompt.json` file to see exactly what parameters were used

---

## Advanced: Tweaking Scene Gap

The `sceneGap` in `script.ts` controls time between scenes. It's calculated dynamically in Composition.tsx:

```typescript
const gapFrames = Math.round(config.sceneGap * FPS);
```

**Benefits:**
- Change gap without regenerating audio
- Easy A/B testing of pacing
- Adjust in one place, affects entire video

**Typical values:**
- `0.1` - Tight cuts, fast pace
- `0.3` - Default, good balance
- `0.5` - Slower, tutorial-style
