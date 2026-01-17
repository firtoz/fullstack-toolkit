/**
 * Video: 2026-01-dx-focus
 * Description: Developer Experience focused video - highlighting ease of use
 * Duration: ~24s
 * Voice: Liam (energetic preset)
 *
 * Key message: React Router is type-safe, but router-toolkit makes it EASY.
 */

import type { Scene, VideoConfig } from "../../shared/lib/video-types";

export const VIDEO_ID = "2026-01-dx-focus";

export const config: VideoConfig = {
	fps: 30,
	width: 1920,
	height: 1080,
	sceneGap: 0.3, // 0.3 seconds gap between scenes
};

// Scene definitions - focused on DX benefits
// NOTE: Positive tone - React Router is great, router-toolkit makes it even better
export const scenes: Scene[] = [
	{
		id: "hook",
		narration: "React Router is great. But what if it could be even easier?",
		visual: "React Router logo with checkmark, then lightbulb moment",
		markers: [
			{
				// Highlight "great" when spoken
				id: "greatHighlight",
				start: { type: "wordStart", word: "great" },
				end: { type: "wordEnd", word: "great" },
			},
			{
				// When second line appears
				id: "secondLineAppear",
				start: { type: "wordStart", word: "what" },
				end: { type: "wordStart", word: "what" },
			},
			{
				// Highlight "even easier" phrase
				id: "evenEasierHighlight",
				start: { type: "wordStart", word: "even" },
				end: { type: "wordEnd", word: "easier" },
			},
		],
	},
	{
		id: "problem",
		narration: "Fetchers. Submission state. Form actions. A lot to wire up.",
		visual: "Show code snippets stacking up, growing complexity",
		markers: [
			{
				// First item appears
				id: "fetchersAppear",
				start: { type: "wordStart", word: "fetchers" },
				end: { type: "wordEnd", word: "fetchers" },
			},
			{
				// Second item appears
				id: "submissionAppear",
				start: { type: "wordStart", word: "submission" },
				end: { type: "wordEnd", word: "state" },
			},
			{
				// Third item appears
				id: "formAppear",
				start: { type: "wordStart", word: "form" },
				end: { type: "wordEnd", word: "actions" },
			},
			{
				// "A lot to wire up" text
				id: "wireUpAppear",
				start: { type: "wordStart", word: "lot" },
				end: { type: "wordEnd", word: "up" },
			},
		],
	},
	{
		id: "solution",
		narration:
			"router-toolkit. Dynamic fetchers and submitters that just work.",
		visual: "Logo reveal, clean simple code snippet",
		markers: [
			{
				// Logo and name appear with "toolkit"
				id: "toolkitReveal",
				start: { type: "wordStart", word: "toolkit" },
				end: { type: "wordEnd", word: "toolkit" },
			},
			{
				// Tagline appears with "dynamic"
				id: "taglineAppear",
				start: { type: "wordStart", word: "dynamic" },
				end: { type: "wordEnd", word: "submitters" },
			},
			{
				// "just work" highlight
				id: "justWorkHighlight",
				start: { type: "wordStart", word: "just" },
				end: { type: "wordEnd", word: "work" },
			},
		],
	},
	{
		id: "features",
		narration:
			"useDynamicFetcher. useDynamicSubmitter. Type-safe form actions. All connected.",
		visual: "Show the three hooks with code, then connection diagram",
		markers: [
			{
				// First feature (useDynamicFetcher) - first "use" occurrence
				id: "feature1Appear",
				start: { type: "wordStart", word: "use", occurrence: 1 },
				end: { type: "wordEnd", word: "fetcher", occurrence: 1 },
			},
			{
				// Second feature (useDynamicSubmitter) - second "use" occurrence
				id: "feature2Appear",
				start: { type: "wordStart", word: "use", occurrence: 2 },
				end: { type: "wordEnd", word: "submitter" },
			},
			{
				// Third feature (type-safe form actions) - "Type-safe" is hyphenated in transcription
				id: "feature3Appear",
				start: { type: "wordStart", word: "type-safe" },
				end: { type: "wordEnd", word: "actions" },
			},
			{
				// "All connected" diagram - starts at "all", ends at "connected"
				id: "connectedDiagram",
				start: { type: "wordStart", word: "all" },
				end: { type: "wordEnd", word: "connected" },
			},
		],
	},
	{
		id: "cta",
		narration: "Fully type-safe. One install. Build even faster.",
		visual: "CTA with install command and final message",
		markers: [
			{
				// "Fully type-safe" highlight
				id: "fullySafeAppear",
				start: { type: "wordStart", word: "fully" },
				end: { type: "wordEnd", word: "type-safe" },
			},
			{
				// Terminal with install command
				id: "installAppear",
				start: { type: "wordStart", word: "one" },
				end: { type: "wordEnd", word: "install" },
			},
			{
				// "Build even faster" final message
				id: "buildFasterAppear",
				start: { type: "wordStart", word: "build" },
				end: { type: "wordEnd", word: "faster" },
			},
		],
	},
];

/** Get the full narration text for voiceover generation (legacy) */
export function getFullNarration(): string {
	return scenes.map((s) => s.narration).join(" ");
}

/** Code snippets to display in the video */
export const codeSnippets = {
	/** Boilerplate problem */
	boilerplate: `// Without router-toolkit...
const fetcher = useFetcher();
const [data, setData] = useState(null);
const [error, setError] = useState(null);
const [isLoading, setIsLoading] = useState(false);

useEffect(() => {
  if (fetcher.data) setData(fetcher.data);
  if (fetcher.state === 'loading') setIsLoading(true);
  // ... and more state management
}, [fetcher]);`,

	/** Clean solution */
	solution: `// With router-toolkit
const fetcher = useDynamicFetcher<typeof import("./api")>("/api");

// That's it. Full type safety.
fetcher.data   // typed response
fetcher.error  // typed errors
fetcher.state  // loading states`,

	/** useDynamicFetcher */
	dynamicFetcher: `const users = useDynamicFetcher<
  typeof import("./users")
>("/users");

// Auto-typed!
users.load({ search: "john" });
users.data?.map(u => u.name);`,

	/** useDynamicSubmitter */
	dynamicSubmitter: `const login = useDynamicSubmitter<
  typeof import("./auth/login")
>("/auth/login");

// Type-safe submit
login.submitJson({ 
  email: "user@example.com",
  password: "secret" 
});`,

	/** Form action */
	formAction: `export const action = formAction({
  schema: z.object({
    email: z.string().email(),
    password: z.string().min(8),
  }),
  handler: async (args, data) => {
    // data is fully typed!
    return success({ user });
  },
});`,

	/** Install command */
	installCommand: `bun add @firtoz/router-toolkit`,
};
