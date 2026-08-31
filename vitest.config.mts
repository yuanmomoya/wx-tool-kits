import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: [
        'src/packages/**/*.logic.ts',
        'src/services/localCompress.ts',
        'src/utils/image-metadata.ts',
        'src/utils/pindou-engine.ts',
        'src/utils/poker-ledger.ts',
      ],
      exclude: ['**/*.test.ts'],
      thresholds: {
        statements: 85,
        lines: 85,
        functions: 85,
        branches: 75,
      },
    },
  },
})
