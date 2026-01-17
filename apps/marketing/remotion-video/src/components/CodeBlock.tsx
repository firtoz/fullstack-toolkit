import type React from "react";
import { useMemo } from "react";
import { createHighlighterCoreSync } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import ts from "shiki/langs/typescript.mjs";
import githubDark from "shiki/themes/github-dark.mjs";

interface CodeBlockProps {
	code: string;
	language?: string;
	fontSize?: number;
}

// Create highlighter synchronously for Remotion
const highlighter = createHighlighterCoreSync({
	themes: [githubDark],
	langs: [ts],
	engine: createJavaScriptRegexEngine(),
});

/**
 * Code block component with Shiki syntax highlighting
 */
export const CodeBlock: React.FC<CodeBlockProps> = ({
	code,
	language = "typescript",
	fontSize = 16,
}) => {
	const html = useMemo(() => {
		return highlighter.codeToHtml(code, {
			lang: language,
			theme: "github-dark",
		});
	}, [code, language]);

	return (
		<div
			style={{
				position: "relative",
				background:
					"linear-gradient(135deg, rgba(15, 15, 25, 0.95) 0%, rgba(20, 20, 35, 0.95) 100%)",
				border: "1px solid rgba(100, 100, 255, 0.2)",
				borderRadius: 16,
				padding: "32px 40px",
				overflow: "hidden",
				fontSize,
				lineHeight: 1.7,
				fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
				boxShadow:
					"0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(100, 100, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
			}}
		>
			{/* Top accent line */}
			<div
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					right: 0,
					height: 2,
					background:
						"linear-gradient(90deg, transparent 0%, rgba(100, 100, 255, 0.6) 20%, rgba(100, 100, 255, 0.6) 80%, transparent 100%)",
				}}
			/>

			{/* Code content with style overrides */}
			<style
				// biome-ignore lint/security/noDangerouslySetInnerHtml: CSS is safe
				dangerouslySetInnerHTML={{
					__html: `
						.shiki-code-wrapper pre {
							background: transparent !important;
							padding: 0 !important;
							margin: 0 !important;
						}
						.shiki-code-wrapper code {
							background: transparent !important;
						}
					`,
				}}
			/>
			<div
				className="shiki-code-wrapper"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: Shiki output is safe
				dangerouslySetInnerHTML={{ __html: html }}
			/>

			{/* Bottom corner accent */}
			<div
				style={{
					position: "absolute",
					bottom: 8,
					right: 8,
					width: 40,
					height: 40,
					background:
						"radial-gradient(circle at bottom right, rgba(100, 100, 255, 0.15) 0%, transparent 70%)",
					pointerEvents: "none",
				}}
			/>
		</div>
	);
};
