import mermaid from "mermaid";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { continueRender, delayRender } from "remotion";

interface MermaidDiagramProps {
	chart: string;
	width?: string | number;
	height?: string | number;
	theme?: "dark" | "neutral";
	scale?: number;
}

// Initialize mermaid with dark theme configuration
mermaid.initialize({
	startOnLoad: false,
	theme: "dark",
	themeVariables: {
		primaryColor: "#6366f1",
		primaryTextColor: "#ffffff",
		primaryBorderColor: "#818cf8",
		lineColor: "#a5b4fc",
		secondaryColor: "#f97316",
		tertiaryColor: "#22c55e",
		background: "#1a1a2e",
		mainBkg: "#262640",
		secondBkg: "#2a2a45",
		textColor: "#ffffff",
		border1: "#818cf8",
		border2: "#a5b4fc",
		fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
		fontSize: "20px",
		nodeBorder: "#818cf8",
		clusterBkg: "#1a1a2e",
		clusterBorder: "#6366f1",
		edgeLabelBackground: "#1a1a2e",
	},
	flowchart: {
		curve: "basis",
		padding: 40,
		nodeSpacing: 100,
		rankSpacing: 120,
	},
});

/**
 * MermaidDiagram component for rendering Mermaid diagrams in Remotion videos
 * Uses useState to handle async rendering properly
 */
export const MermaidDiagram: React.FC<MermaidDiagramProps> = ({
	chart,
	width,
	height,
	scale = 1,
}) => {
	const [svgContent, setSvgContent] = useState<string>("");

	const diagramId = useMemo(
		() => `mermaid-${Math.random().toString(36).substring(7)}`,
		[],
	);

	useEffect(() => {
		let mounted = true;
		const handle = delayRender();

		const renderDiagram = async () => {
			console.log("chart", chart);
			const startTime = performance.now();
			try {
				const result = await mermaid.render(diagramId, chart).then(
					(result) => {
						console.log("result", result);
						return result;
					},
					(error) => {
						console.error("Failed to render Mermaid diagram:", error);
						throw error;
					},
				);
				console.log("result", result);
				const endTime = performance.now();
				console.log(`Mermaid diagram rendered in ${endTime - startTime}ms`);
				if (mounted) {
					// Extract SVG from result
					const svg = typeof result === "string" ? result : result.svg;
					setSvgContent(svg);
					continueRender(handle);
				}
			} catch (error) {
				console.error("Failed to render Mermaid diagram:", error);
				if (mounted) {
					setSvgContent(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="200">
						<rect width="800" height="200" fill="#1a1a2e" />
						<text x="400" y="100" fill="#ef4444" font-family="monospace" font-size="24" text-anchor="middle">
							Error rendering diagram: ${error instanceof Error ? error.message : "Unknown error"}
						</text>
					</svg>`);
					continueRender(handle);
				}
			}
		};

		renderDiagram();

		return () => {
			mounted = false;
			continueRender(handle);
		};
	}, [chart, diagramId]);

	return (
		<div
			style={{
				position: "relative",
				background:
					"linear-gradient(135deg, rgba(15, 15, 25, 0.95) 0%, rgba(20, 20, 35, 0.95) 100%)",
				border: "1px solid rgba(99, 102, 241, 0.3)",
				borderRadius: 16,
				padding: "40px",
				overflow: "hidden",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				boxShadow:
					"0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(99, 102, 241, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
				...(width && { width }),
				...(height && { height }),
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
						"linear-gradient(90deg, transparent 0%, rgba(99, 102, 241, 0.6) 20%, rgba(99, 102, 241, 0.6) 80%, transparent 100%)",
				}}
			/>

			{/* Mermaid diagram content */}
			<div
				style={{
					transform: `scale(${scale})`,
					transformOrigin: "center center",
				}}
				// biome-ignore lint/security/noDangerouslySetInnerHtml: Mermaid SVG output is safe
				dangerouslySetInnerHTML={{ __html: svgContent }}
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
						"radial-gradient(circle at bottom right, rgba(99, 102, 241, 0.15) 0%, transparent 70%)",
					pointerEvents: "none",
				}}
			/>
		</div>
	);
};
