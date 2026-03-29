import type { Config } from "@react-router/dev/config";

export default {
	ssr: true,
	// Required with @cloudflare/vite-plugin so SSR shares one React/router graph;
	// without it, <Meta>/<Links>/<Scripts> miss FrameworkContext from <ServerRouter>.
	future: {
		v8_viteEnvironmentApi: true,
	},
} satisfies Config;
