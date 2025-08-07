import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // biome-ignore lint/suspicious/noExplicitAny: vite-tsconfig-paths plugin type compatibility issue
  plugins: [tsconfigPaths() as any],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test-setup.ts'],
  },
}) 