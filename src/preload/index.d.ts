import type { ParallaxApi } from '../shared/ipc'

declare global {
  interface Window {
    api: ParallaxApi
  }
}

export {}
