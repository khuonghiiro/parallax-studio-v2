import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    {
      name: 'strip-shebang',
      transform(code) {
        if (code.startsWith('#!')) {
          return { code: code.replace(/^#!.*/, '// shebang') }
        }
      }
    }
  ],
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src'),
      '@shared': resolve(__dirname, 'src/shared')
    }
  },
  test: {
    include: ['src/**/*.test.ts', 'mcp-server/catalog/**/*.test.mjs', 'scripts/**/*.test.mjs'],
    environment: 'node'
  }
})
