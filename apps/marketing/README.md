# Marketing App

This package creates marketing videos for router-toolkit using Remotion, ElevenLabs, and Claude Opus 4.5.

## Overview

The marketing app uses an AI-driven workflow where Claude Opus 4.5 generates video scripts with declarative timing markers, which are then automatically processed into synchronized audio and visual compositions.

## Prerequisites

- **Cursor IDE** with Plan Mode enabled
- **Claude Opus 4.5** (or Sonnet 4.5) access
- **Bun** runtime installed
- **ElevenLabs API key** in `.env` file

## Quick Start

### Creating a New Video

1. **Open Cursor in Plan Mode**
   - Navigate to `apps/marketing` directory
   - Start a new Plan Mode session
   - Select **Claude Opus 4.5** as the model

2. **Provide Instructions**
   
   Example prompt:
   ```
   Make a video explaining [TOPIC] using the marketing package playbook as a guide.
   Use voice "liam" with "energetic" preset.
   ```

3. **AI Generates Script Files**
   
   Claude will create a new video folder at:
   ```
   apps/marketing/videos/YYYY-MM-topic/
   ├── script.ts          # Scene definitions with markers
   └── scenes/            # (created later)
   ```

4. **Process the Video**
   
   Run the automated pipeline:
   ```bash
   cd apps/marketing
   bun run process-video YYYY-MM-topic liam energetic
   ```
   
   This command:
   - Generates audio for each scene via ElevenLabs
   - Transcribes audio with word-level timing
   - Validates all markers exist in transcription
   - Auto-retries up to 3 times if validation fails
   - Creates `timing.ts` with resolved frame numbers
   - Copies audio files to `remotion-video/public/`

5. **Review Outputs**
   
   Check the generated files:
   ```
   apps/marketing/videos/YYYY-MM-topic/
   ├── script.ts
   ├── timing.ts              # ✅ Auto-generated
   ├── audio/
   │   ├── hook.mp3          # ✅ Generated
   │   ├── problem.mp3
   │   └── ...
   ├── transcriptions/        # (gitignored)
   └── attempts/              # (gitignored, if retries happened)
   ```

6. **Build Scene Components**
   
   Claude creates React components for each scene:
   ```
   apps/marketing/videos/YYYY-MM-topic/scenes/
   ├── HookScene.tsx
   ├── ProblemScene.tsx
   └── ...
   ```

7. **Create Composition**
   
   Use the shared `VideoComposition` component:
   ```tsx
   import { VideoComposition, createCompositionConfig } from "../../shared/components/VideoComposition";
   import { HookScene } from "./scenes/HookScene";
   // ... import other scenes
   
   const sceneComponents = {
     hook: HookScene,
     problem: ProblemScene,
     // ... map all scenes
   };
   
   export const MyVideo: React.FC = () => {
     return (
       <VideoComposition
         videoId={VIDEO_ID}
         config={config}
         sceneTimings={sceneTimings}
         sceneComponents={sceneComponents}
       />
     );
   };
   
   export const myVideoComposition = createCompositionConfig(
     VIDEO_ID,
     config,
     sceneTimings,
     MyVideo,
   );
   ```

8. **Register in Root.tsx**
   
   Add to `remotion-video/src/Root.tsx`:
   ```tsx
   import { myVideoComposition } from "../../videos/YYYY-MM-topic/Composition";
   
   <Composition {...myVideoComposition} />
   ```

9. **Preview & Render**
   
   ```bash
   # Preview in browser
   cd apps/marketing/remotion-video
   bun run dev
   
   # Render final video
   bunx remotion render src/index.ts YYYY-MM-topic out/YYYY-MM-topic.mp4
   ```

## Command Reference

### Process Video

```bash
bun run process-video <video-id> [voice] [preset] [speed] [--force]
```

**Arguments:**
- `video-id` - Video folder name (required)
- `voice` - Voice name (default: `liam`)
- `preset` - `professional`, `energetic`, `calm` (default: `energetic`)
- `speed` - Speech speed 0.5-2.0 (default: `1.0`)
- `--force` - Force regenerate all scenes (skip cache)

**Examples:**
```bash
# Use defaults
bun run process-video 2026-01-dx-focus

# Custom voice and preset
bun run process-video 2026-01-dx-focus liam energetic

# Faster pace for social media
bun run process-video 2026-01-dx-focus liam energetic 1.2

# Force regenerate everything
bun run process-video 2026-01-dx-focus --force
```

### Generate Image

Generate AI images using fal.ai's nano-banana-pro model.

```bash
bun run gen-image <prompt> <output-path>
```

**Arguments:**
- `prompt` - Text description of the image to generate (required, use quotes)
- `output-path` - Path where the image will be saved (required, directories created automatically)

**Examples:**
```bash
# Generate a simple image
bun run gen-image "a flying turtle" images/turtle.png

# Generate to nested path (auto-creates directories)
bun run gen-image "a red sports car on a mountain road" scenes/intro/car.png

# Complex prompt
bun run gen-image "a cozy coffee shop interior with warm lighting, photorealistic" assets/coffee-shop.png
```

### Edit Image

Edit existing images with AI-powered transformations using fal.ai's nano-banana-pro/edit model.

```bash
bun run edit-image <input-path> <prompt> <output-path>
```

**Arguments:**
- `input-path` - Path to the image to edit (required)
- `prompt` - Description of the changes to make (required, use quotes)
- `output-path` - Path where the edited image will be saved (required)

**Examples:**
```bash
# Simple color change
bun run edit-image input.png "make it blue" output.png

# Add elements
bun run edit-image scene.png "add a sunset in the background" scene-sunset.png

# Transform style
bun run edit-image photo.png "make it look like a watercolor painting" photo-watercolor.png
```

### Development

```bash
# Start Remotion preview
cd remotion-video
bun run dev

# Type check
bun run typecheck

# Lint and format
bun run lint
```

## Workflow Diagram

```
┌─────────────────────┐
│ Prompt Opus 4.5     │
│ with topic & style  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Generate script.ts  │
│ with scenes/markers │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ bun run             │
│ process-video       │
└──────────┬──────────┘
           │
     ┌─────┴─────┐
     ▼           ▼
┌─────────┐ ┌──────────────┐
│ Audio   │ │ Transcribe   │
│ via     │ │ + Validate   │
│ Eleven  │ │ Markers      │
│ Labs    │ │              │
└────┬────┘ └──────┬───────┘
     │             │
     └──────┬──────┘
            ▼
   ┌─────────────────┐
   │ timing.ts       │
   │ (resolved       │
   │  markers)       │
   └────────┬────────┘
            │
            ▼
   ┌─────────────────┐
   │ Build Scene     │
   │ Components      │
   └────────┬────────┘
            │
            ▼
   ┌─────────────────┐
   │ Preview +       │
   │ Render Video    │
   └─────────────────┘
```

## Project Structure

```
apps/marketing/
├── README.md                  # This file
├── PLAYBOOK.md                # Detailed production guide
├── .env                       # ELEVENLABS_API_KEY
├── package.json
├── shared/
│   ├── components/
│   │   └── VideoComposition.tsx    # Reusable composition logic
│   ├── lib/
│   │   └── video-types.ts          # TypeScript types
│   └── scripts/
│       ├── process-video.ts        # Automated pipeline
│       └── marker-resolver.ts      # Marker validation
├── videos/
│   └── YYYY-MM-topic/              # One folder per video
│       ├── script.ts               # Scene definitions
│       ├── timing.ts               # Auto-generated
│       ├── Composition.tsx         # Video composition
│       ├── audio/                  # Generated audio
│       ├── transcriptions/         # (gitignored)
│       ├── attempts/               # (gitignored)
│       └── scenes/                 # Scene components
└── remotion-video/
    ├── src/
    │   ├── Root.tsx                # Composition registry
    │   └── components/
    │       ├── CodeBlock.tsx       # Code syntax highlighting
    │       └── MermaidDiagram.tsx  # Diagram rendering
    └── public/
        └── YYYY-MM-topic/audio/    # Audio for Remotion
```

## Key Concepts

### Markers

Markers define **when** visual events happen, tied to narration words:

```typescript
{
  id: "highlight",
  start: { type: 'wordStart', word: 'great' },
  end: { type: 'wordEnd', word: 'great' },
}
```

The `process-video` script automatically resolves these to frame numbers.

### Reusable Composition

All videos use the shared `VideoComposition` component which handles:
- Scene sequencing with configurable gaps
- Audio prefetching and sync
- Marker-driven timing
- Background styling

This ensures consistency and reduces boilerplate.

### Smart Caching

The `process-video` script caches audio/transcriptions per scene:
- **Script unchanged?** → Skips scene (fast iteration)
- **Script changed?** → Regenerates only that scene
- **Validation failed?** → Auto-retries up to 3 times

## Tips

- **Use the PLAYBOOK.md** - It contains detailed guidance on script structure, marker patterns, and scene building
- **Start with Opus 4.5** - It understands the workflow and generates high-quality scripts
- **Reference existing videos** - Look at `2026-01-dx-focus` as a template
- **Test markers early** - Run `process-video` after writing the script to validate markers before building scenes
- **Adjust scene gaps** - Change `config.sceneGap` in `script.ts` to control pacing (no need to regenerate audio)

## Troubleshooting

### Marker validation fails

Check `attempts/scene-attempt-1/transcription.json` to see actual transcribed words. Update marker words to match.

### Audio out of sync

Ensure you ran `process-video` after changing the script. Markers are auto-resolved from transcription.

### Scene feels rushed/slow

Adjust `speed` parameter: `1.0` for normal, `1.2` for energetic, or change `config.sceneGap` for more breathing room.

## Next Steps

1. Read [PLAYBOOK.md](PLAYBOOK.md) for detailed production guidance
2. Study the existing video at `videos/2026-01-dx-focus/`
3. Start a Plan Mode session and create your first video!
