# Agent Instructions for Marketing Package

## Core Mindset

When working on this marketing package, **always evaluate from the perspective of a seasoned marketing professional**, not just a developer. Ask yourself:

- **Does this communicate real value?** Not "does it look cool?"
- **Would this make someone take action?** Not "is it technically impressive?"
- **Is the message clear and benefit-driven?** Not "does it use trendy aesthetics?"

See **[Marketing Philosophy](./docs/marketing-philosophy.md)** for the complete quality standards and evaluation framework.

---

This is the main entry point for AI agents. The detailed guidelines have been organized into topic-specific files for better clarity and maintainability.

## Quick Navigation

### 📋 Core Guidelines
- **[Marketing Philosophy](./docs/marketing-philosophy.md)** - Core mindset, quality standards, common pitfalls, and the "Seasoned Expert" test
- **[Video Workflow](./docs/video-workflow.md)** - Script processing, audio sharing, and general video development workflow
- **[Remotion Guidelines](./docs/remotion-guidelines.md)** - Technical guidelines specific to Remotion (no transitions, animation sync, layout calculations, etc.)
- **[Image Generation](./docs/image-generation.md)** - Commands, workflow, and quality guidelines for generating video images
- **[Platform Safe Zones](./docs/platform-safezones.md)** - UI overlay specifications for TikTok, Instagram, YouTube, etc.

## Getting Started

### For Marketing Content (Copy, Messaging)
1. Read **[Marketing Philosophy](./docs/marketing-philosophy.md)** first
2. Apply the "Seasoned Expert" test to all work
3. Focus on ROI, not RGB

### For Video Creation
1. Start with **[Video Workflow](./docs/video-workflow.md)** - understand script processing
2. Read **[Remotion Guidelines](./docs/remotion-guidelines.md)** for technical implementation
3. If generating images: **[Image Generation](./docs/image-generation.md)**
4. For social media videos: **[Platform Safe Zones](./docs/platform-safezones.md)**

## Core Principles (TL;DR)

1. **Think like a marketing professional**, not just a developer
2. **Always process `script.ts` before editing scene files** - run `bun run process-video`
3. **NEVER use CSS transitions in Remotion** - use `interpolate()` with proper easing
4. **Match easing functions** when animating cursor + UI interactions
5. **React instantly** - UI changes on same frame as interactions
6. **Actually generate images** - don't just write prompt files
7. **Account for platform safe zones** - different platforms have different UI overlays

## Quality Bar

Every asset should score **8/10 or higher** on:
- **Relevance:** Does it support the core message?
- **Substance:** Does it communicate real value?
- **Professionalism:** Would a marketing expert approve?
- **Effectiveness:** Would it make someone take action?

## Remember

**Gradients don't convert. Clear value propositions do.**

Your job isn't to make things "look cool" - it's to make marketing assets that actually work.
