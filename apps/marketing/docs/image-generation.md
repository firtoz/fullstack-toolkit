# Image Generation Guidelines

## ⚠️ CRITICAL: Actually Generate Images

**When a video needs images, you MUST generate them using the image generation script. Do NOT just write prompt files and leave them ungenerated.**

## Image Generation Commands

### Mode 1: Direct prompt (creates both image and prompt.json)
```bash
cd apps/marketing
bun run gen-image "your prompt here" remotion-video/public/<video-id>/images/image-name.png "16:9" "1K"
```

### Mode 2: From existing prompt.json (image only, no new JSON created)
```bash
cd apps/marketing
bun run gen-image --json remotion-video/public/<video-id>/images/image-name.prompt.json remotion-video/public/<video-id>/images/image-name.png
```

**For multiple images:** Simply run the command multiple times with different file names. For example, when creating a TikTok video with 9 images, run the command 9 times with the appropriate prompt JSON files.

## Workflow for Creating Videos with Images

1. **Write the script.ts** - Define narration and scene structure
2. **Identify needed images** - What visuals does each scene require?
3. **Create prompt.json files** (if creating a new video template) - Define image prompts with aspect ratio
4. **GENERATE THE IMAGES** - Run `gen-image` command for each image file needed (use `--json` flag to use existing prompt.json files)
5. **Run process-video** - Generate audio and timing data
6. **Create scene TSX files** - Use the generated images and markers
7. **Preview** - `cd remotion-video && bun run dev`

### Example for generating multiple images
```bash
cd apps/marketing
# Generate all 9 images for a TikTok video
bun run gen-image --json remotion-video/public/2026-01-meta-workflow-tiktok/images/hook-bg.prompt.json remotion-video/public/2026-01-meta-workflow-tiktok/images/hook-bg.png
bun run gen-image --json remotion-video/public/2026-01-meta-workflow-tiktok/images/prompt-before.prompt.json remotion-video/public/2026-01-meta-workflow-tiktok/images/prompt-before.png
# ... continue for each image
```

## Image Quality Guidelines

When generating images with AI:
1. **Think substance first:** What message needs to be communicated?
2. **Be specific in prompts:** "Professional marketing copy showing quantifiable benefits" not "make it cool"
3. **Iterate with purpose:** Each version should improve the **message**, not just add effects
4. **Check the output critically:** Does it actually work from a marketing perspective?
5. **Regenerate if needed:** If an image doesn't work, refine the prompt and regenerate

## Aspect Ratios

- **16:9** - Standard horizontal video (YouTube, Vimeo)
- **9:16** - Vertical video (TikTok, Instagram Reels, YouTube Shorts)
- **1:1** - Square (Instagram posts)

Always match the aspect ratio to your video format!
