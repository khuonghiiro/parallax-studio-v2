import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import aiSourceLocatorBabelPlugin from './scripts/vite/aiSourceLocatorBabel.mjs'

/**
 * AI UI Inspector (Win + Shift): khi chạy dev, gắn `data-ai-src="file:dòng:cột"` vào JSX để bản quét
 * chỉ thẳng dòng code cho AI. Không bật khi build production. Tắt tạm bằng `PXS_AI_SRC=0`.
 */
function rendererReactPlugin(command: 'build' | 'serve') {
  const enableAiSource = command === 'serve' && process.env.PXS_AI_SRC !== '0'
  return enableAiSource ? react({ babel: { plugins: [aiSourceLocatorBabelPlugin] } }) : react()
}

export default defineConfig(({ command }) => ({
  main: {
    resolve: { alias: { '@shared': resolve('src/shared') } }
  },
  preload: {
    resolve: { alias: { '@shared': resolve('src/shared') } }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [rendererReactPlugin(command)]
  }
}))
