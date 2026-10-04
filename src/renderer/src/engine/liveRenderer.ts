import type { SceneRenderer } from './SceneRenderer'

/** The interactive viewer's renderer (for diagnostics such as MCP `get_memory_stats`). */
let live: SceneRenderer | null = null

export function setLiveRenderer(r: SceneRenderer | null): void {
  live = r
}

export function getLiveRenderer(): SceneRenderer | null {
  return live
}
