/**
 * Video: 2026-01-meta-workflow
 * Description: "Prompt to Video" workflow - AI as the creative partner
 * Duration: ~40s
 * Voice: Liam (energetic preset)
 *
 * Key message: You provide the vision (prompt), AI handles the details (script), code handles the execution.
 */

import type { Scene, VideoConfig } from "../../shared/lib/video-types";

export const VIDEO_ID = "2026-01-meta-workflow";

export const config: VideoConfig = {
	fps: 30,
	width: 1920,
	height: 1080,
	sceneGap: 0.2, // Fast paced
	sharedAudioId: "2026-01-meta-workflow", // Share audio with TikTok version
};

export const scenes: Scene[] = [
	{
		id: "hook",
		narration: "What if you could direct a video just by talking to an AI?",
		visual:
			"A chat interface with 'Make a video about...' being typed. The text glows.",
		markers: [
			{
				id: "directVideo",
				start: { type: "wordStart", word: "direct" },
				end: { type: "wordEnd", word: "video" },
			},
			{
				id: "talkingToAI",
				start: { type: "wordStart", word: "talking" },
				end: { type: "wordEnd", word: "AI" },
			},
		],
	},
	{
		id: "prompt",
		narration:
			"You ask Gemini or Opus. Make a video about our new feature. It writes the script.",
		visual:
			"Typing animation synced to narration, then transform to polished result.",
		markers: [
			{
				id: "askAI",
				start: { type: "wordStart", word: "ask" },
				end: { type: "wordEnd", word: "Opus" },
			},
			// Typing animation markers - synced to each word in "Make a video about our new feature"
			{
				id: "typeMake",
				start: { type: "wordStart", word: "Make" },
				end: { type: "wordEnd", word: "Make" },
			},
			{
				id: "typeVideo",
				start: { type: "wordStart", word: "video" },
				end: { type: "wordEnd", word: "video" },
			},
			{
				id: "typeAbout",
				start: { type: "wordStart", word: "about" },
				end: { type: "wordEnd", word: "about" },
			},
			{
				id: "typeOur",
				start: { type: "wordStart", word: "our" },
				end: { type: "wordEnd", word: "our" },
			},
			{
				id: "typeNew",
				start: { type: "wordStart", word: "new" },
				end: { type: "wordEnd", word: "new" },
			},
			{
				id: "typeFeature",
				start: { type: "wordStart", word: "feature" },
				end: { type: "wordEnd", word: "feature" },
			},
			{
				id: "writesScript",
				start: { type: "wordEnd", word: "feature" },
				end: { type: "wordEnd", word: "script" },
			},
		],
	},
	{
		id: "refine",
		narration:
			"Want it flashier? Just ask. Make it sexy. Make it cool. It updates instantly.",
		visual:
			"Chat bubbles appear for each request, visual transforms step by step.",
		markers: [
			{
				id: "flashier",
				start: { type: "wordStart", word: "want" },
				end: { type: "wordEnd", word: "flashier" },
			},
			{
				id: "justAsk",
				start: { type: "wordStart", word: "just" },
				end: { type: "wordEnd", word: "ask" },
			},
			{
				id: "makeSexy",
				start: { type: "wordStart", word: "sexy" },
				end: { type: "wordEnd", word: "sexy" },
			},
			{
				id: "makeCool",
				start: { type: "wordStart", word: "cool" },
				end: { type: "wordEnd", word: "cool" },
			},
			{
				id: "updatesInstantly",
				start: { type: "wordStart", word: "updates" },
				end: { type: "wordEnd", word: "instantly" },
			},
		],
	},
	{
		id: "execution",
		narration:
			"The engine takes over. Audio generation, timing, sync. All automatic.",
		visual:
			"Terminal with progress bars showing automatic execution. Final video rendering.",
		markers: [
			{
				id: "engineTakesOver",
				start: { type: "wordStart", word: "engine" },
				end: { type: "wordEnd", word: "over" },
			},
			{
				id: "audioWord",
				start: { type: "wordStart", word: "Audio" },
				end: { type: "wordEnd", word: "Audio" },
			},
			{
				id: "timingWord",
				start: { type: "wordStart", word: "timing" },
				end: { type: "wordEnd", word: "timing" },
			},
			{
				id: "syncWord",
				start: { type: "wordStart", word: "sync" },
				end: { type: "wordEnd", word: "sync" },
			},
			{
				id: "allWord",
				start: { type: "wordStart", word: "all" },
				end: { type: "wordEnd", word: "all" },
			},
			{
				id: "allAutomatic",
				start: { type: "wordStart", word: "all" },
				end: { type: "wordEnd", word: "automatic" },
			},
		],
	},
	{
		id: "cta",
		narration:
			"From prompt, to video. This is your new creative partner. Check the playbook.",
		visual:
			"Split screen: Chat prompt on left, beautiful final video on right. Merging into logo.",
		markers: [
			{
				id: "fromWord",
				start: { type: "wordStart", word: "from", offset: -0.5 },
				end: { type: "wordEnd", word: "from" },
			},
			{
				id: "promptWord",
				start: { type: "wordStart", word: "prompt" },
				end: { type: "wordEnd", word: "prompt" },
			},
			{
				id: "toWord",
				start: { type: "wordStart", word: "to" },
				end: { type: "wordEnd", word: "to" },
			},
			{
				id: "videoWord",
				start: { type: "wordStart", word: "video" },
				end: { type: "wordEnd", word: "video" },
			},
			{
				id: "creativePartner",
				start: { type: "wordStart", word: "creative", offset: -0.5 },
				end: { type: "wordEnd", word: "partner" },
			},
			{
				id: "checkPlaybook",
				start: { type: "wordStart", word: "check" },
				end: { type: "wordEnd", word: "playbook" },
			},
		],
	},
];

/** Code snippets and diagram definitions */
export const codeSnippets = {
	processCommand: `bun run process-video 2026-01-meta-workflow liam energetic`,
	promptExample: `"Make a video about our new feature. Make it flashy!"`,
	// Meta: The actual script for this video!
	scriptSnippet: `export const scenes: Scene[] = [
  {
    id: "hook",
    narration: "What if you could direct a video just by talking to an AI?",
    visual: "A chat interface with 'Make a video about...' being typed.",
    markers: [...]
  },
  {
    id: "prompt",
    narration: "You ask Gemini or Opus. Make a video about our new feature. It writes the script.",
    visual: "Typing animation synced to narration, then transform to polished result.",
    markers: [...]
  },
  {
    id: "refine",
    narration: "Want it flashier? Just ask. Make it sexy. Make it cool. It updates instantly.",
    visual: "Chat bubbles appear, visual transforms step by step.",
    markers: [...]
  },
  {
    id: "execution",
    narration: "The engine takes over. Audio generation, timing, sync. All automatic.",
    visual: "Terminal with progress bars showing automatic execution.",
    markers: [...]
  }
];`,
	githubUrl: `github.com/firtoz/fullstack-toolkit`,
};
