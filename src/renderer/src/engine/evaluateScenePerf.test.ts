import { describe, expect, it } from 'vitest'
import { createImageLayer, createProject, createShot } from '../project/factory'
import { evaluateScene } from './evaluateScene'
import { createDefaultDepthPortal, createDefaultVirtualLight } from './virtualLight'

describe('evaluateScene 60fps performance & out-of-range shot culling', () => {
  it('skips virtualLight & depthPortal evaluation on inactive shots and evaluates 120 layers rapidly', () => {
    const project = createProject({ duration: 15 })
    project.shots = []
    project.layers = []

    for (let s = 0; s < 3; s++) {
      const shot = createShot(`Cảnh ${s + 1}`, [s * 3200, 0, 0], s)
      project.shots.push(shot)
      const inPoint = s * 5
      const outPoint = (s + 1) * 5

      for (let i = 0; i < 40; i++) {
        const layer = createImageLayer(
          {
            id: `asset_${s}_${i}`,
            name: `L_${s}_${i}.png`,
            kind: 'image',
            mime: 'image/png',
            width: 400,
            height: 400
          },
          project.comp,
          i * 10 - 150,
          shot.id
        )
        layer.inPoint = inPoint
        layer.outPoint = outPoint
        if (i === 0) {
          layer.virtualLight = {
            ...createDefaultVirtualLight('candle'),
            enabled: true,
            intensity: 1.2,
            radius: 520
          }
        }
        if (i === 1) {
          layer.physics = {
            enabled: true,
            material: 'stone_wall',
            depthPortal: {
              ...createDefaultDepthPortal(),
              enabled: true
            }
          }
        }
        project.layers.push(layer)
      }
    }

    const ev = evaluateScene(project, 2.5)
    const activeLayers = ev.layers.filter((l) => l.active)
    const inactiveLayers = ev.layers.filter((l) => !l.active)
    expect(activeLayers.length).toBe(40)
    expect(inactiveLayers.length).toBe(80)
    expect(inactiveLayers.every((l) => l.lightIllumination === undefined && l.caveDarkness === undefined)).toBe(true)
    expect(activeLayers.some((l) => l.vlightEnabled === true)).toBe(true)

    const frames = 30
    const t0 = performance.now()
    for (let f = 0; f < frames; f++) {
      evaluateScene(project, (f / frames) * 14.9)
    }
    const avgMs = (performance.now() - t0) / frames
    expect(avgMs).toBeLessThan(8)
  })
})
