import { existsSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { evaluate } from '../animation/keyframes'
import { computeShotStageLayout, extractCameraFrames2D } from '../ui/viewer/animateCamera/animateCameraMath'
import { enrichCameraWaypoints } from '../ui/viewer/animateCamera/animateCameraRouteLogic'
import { exportProjectToJson } from './json/exportJson'
import { buildImmortalSwordMasterProject } from './immortalSwordDemoBuilder'
import { listTimeGroups } from './workflowTimeGroups'

describe('buildImmortalSwordMasterProject — Mẫu 4 Thương Lan Kiếm Cảnh 2.5D', () => {
  it('builds a lean 4-scene 60fps Xuanhuan Donghua demo with 1/(Z+d) corridor depth and diverse camera routes', async () => {
    const project = buildImmortalSwordMasterProject()
    const outPath = resolve(process.cwd(), 'projects/demo-4-thuong-lan-kiem-canh.json')
    if (process.env.WRITE_DEMO4_JSON === '1' || !existsSync(outPath)) {
      const jsonText = await exportProjectToJson(project, true)
      writeFileSync(outPath, jsonText, 'utf8')
    }

    expect(project.shots).toHaveLength(4)
    expect(project.comp.duration).toBe(18)
    expect(project.layers.length).toBeLessThanOrEqual(42)

    // Verify all 13 builtin Donghua S4 art plates exist on disk
    for (const asset of project.assets) {
      expect(asset.assetPath).toMatch(/^builtin\/donghua_s4\//)
      expect(existsSync(resolve(process.cwd(), 'assets', asset.assetPath!))).toBe(true)
    }

    // Scene 2 hero traverses true 1/(Z+d) perspective corridor from deep Z=940 to near Z=170
    const s2Hero = project.layers.find((l) => l.id === 's4-s2-hero')!
    expect(s2Hero.autoScale).toBe(false)
    const posStart = evaluate(s2Hero.transform.position, 4.5)
    const posEnd = evaluate(s2Hero.transform.position, 8.8)
    expect(posStart[2]).toBeGreaterThan(900)
    expect(posEnd[2]).toBeLessThan(200)

    // Smooth optical transitions peak across all 3 cross-shot boundaries
    expect(evaluate(project.camera.fade, 4.5)).toBeGreaterThan(0.5)
    expect(evaluate(project.camera.fade, 9.0)).toBeGreaterThan(0.8)
    expect(evaluate(project.camera.fade, 13.5)).toBeGreaterThan(0.85)
    expect(evaluate(project.camera.fade, 2.0)).toBeCloseTo(0, 2)
    expect(evaluate(project.camera.fade, 16.0)).toBeCloseTo(0, 2)

    // Rich camera route badges in Lộ trình (CameraRouteInspector)
    const layout = computeShotStageLayout(project)
    const waypoints = enrichCameraWaypoints(extractCameraFrames2D(project, layout))
    expect(waypoints.length).toBeGreaterThanOrEqual(16)
    const modes = new Set(waypoints.map((w) => w.actionMode))
    expect(modes.size).toBeGreaterThanOrEqual(8)
    expect(modes.has('crane-down')).toBe(true)
    expect(modes.has('whip-pan')).toBe(true)
    expect(modes.has('orbit-right')).toBe(true)
    expect(modes.has('extreme-closeup')).toBe(true)
    expect(modes.has('hero-low')).toBe(true)
    expect(modes.has('corkscrew')).toBe(true)

    // Clean Workflow V2 graph with shared Time group in Scene 4
    expect(listTimeGroups(project).length).toBeGreaterThanOrEqual(1)
  })
})
