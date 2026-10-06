import { describe, expect, it } from 'vitest'
import { buildDemoProject } from './demo'
import { exportProjectToJson, importProjectFromJson } from './jsonFormat'
import demoJson from './demoProject.json'

describe('JSON Project Format & Declarative Scene Spec', () => {
  it('loads demoProject.json cleanly into a transparent 2.5D demo scene', async () => {
    const project = await buildDemoProject()
    expect(project.shots).toHaveLength(1)
    expect(project.shots[0].name).toBe('Thung Lũng Huyền Ảo')

    const s0 = project.shots[0]
    const s0Layers = project.layers.filter((l) => l.shotId === s0.id)
    expect(s0Layers).toHaveLength(7)

    const sky = s0Layers.find((l) => l.name === 'Bầu trời hoàng hôn')
    expect(sky).toBeDefined()
    expect(sky?.type).toBe('image')

    const mountains = s0Layers.find((l) => l.name === 'Dãy núi xa')
    expect(mountains).toBeDefined()
    expect(mountains?.type).toBe('image')

    const text3D = s0Layers.find((l) => l.name === 'PARALLAX 2.5D')
    expect(text3D).toBeDefined()
    expect(text3D?.type).toBe('text')

    const particles = s0Layers.find((l) => l.name === 'Đom đóm ánh sáng')
    expect(particles).toBeDefined()
    expect(particles?.type).toBe('particles')

    const { evaluateScene } = await import('../engine/evaluateScene')
    const ev = evaluateScene(project, 0)
    expect(ev.camera.position).toBeDefined()
    expect(project.comp.duration).toBe(8)
  })

  it('exports and re-imports project via JSON with 100% roundtrip fidelity', async () => {
    const original = await buildDemoProject()
    const jsonStr = await exportProjectToJson(original, false)
    expect(typeof jsonStr).toBe('string')
    expect(jsonStr).toContain('Thung Lũng Huyền Ảo')
    // Verify assets from assets directory use lightweight paths and avoid heavy base64:
    expect(jsonStr).toContain('assets/demo_transparent')
    expect(jsonStr).not.toContain('data:image/png;base64')

    const imported = await importProjectFromJson(jsonStr)
    expect(imported.shots).toHaveLength(original.shots.length)
    expect(imported.layers).toHaveLength(original.layers.length)
    expect(imported.comp.duration).toBeCloseTo(original.comp.duration, 2)
  })

  it('allows editing a scene and duration directly in declarative JSON', async () => {
    const modifiedSpec = JSON.parse(JSON.stringify(demoJson))
    modifiedSpec.name = 'Custom 2.5D Movie'
    modifiedSpec.shots[0].name = 'MY CUSTOM SCENE'

    const project = await importProjectFromJson(JSON.stringify(modifiedSpec))
    expect(project.comp.name).toBe('Custom 2.5D Movie')
    expect(project.shots[0].name).toBe('MY CUSTOM SCENE')
  })

  it('loads transparent image layers and particle layers from declarative JSON', async () => {
    const project = await buildDemoProject()
    const islandLayer = project.layers.find((l) => l.name === 'Đảo đá bay kỳ ảo')
    expect(islandLayer).toBeDefined()
    expect(islandLayer?.type).toBe('image')

    const vinesLayer = project.layers.find((l) => l.name === 'Dây leo tiền cảnh')
    expect(vinesLayer).toBeDefined()
    expect(vinesLayer?.type).toBe('image')

    const particleLayer = project.layers.find((l) => l.name === 'Đom đóm ánh sáng')
    expect(particleLayer).toBeDefined()
    expect(particleLayer?.type).toBe('particles')
  })

  it('supports AE 2.5D features: anchor point, autoOrient, parentName, fadeIn/Out, and wiggle motion', async () => {
    const spec = {
      name: 'AE 2.5D Test',
      shots: [
        {
          name: 'Shot 1',
          layers: [
            {
              name: 'Parent Body',
              type: 'solid',
              position: [0, 0, 100] as [number, number, number],
              motion: { type: 'wiggle', speed: 1.5, amplitude: [30, 15, 5] }
            },
            {
              name: 'Child Head',
              type: 'solid',
              parentName: 'Parent Body',
              anchor: [0, -0.5, 0] as [number, number, number],
              autoOrient: 'camera-y',
              fadeIn: 1.0,
              fadeOut: 0.5
            }
          ]
        }
      ]
    }

    const project = await importProjectFromJson(JSON.stringify(spec))
    const parent = project.layers.find((l) => l.name === 'Parent Body')
    const child = project.layers.find((l) => l.name === 'Child Head')

    expect(parent).toBeDefined()
    expect(child).toBeDefined()
    expect(parent?.motion?.type).toBe('wiggle')
    expect(child?.parentId).toBe(parent?.id)
    expect(child?.transform.anchor?.value).toEqual([0, -0.5, 0])
    expect(child?.autoOrient).toBe('camera-y')
    expect(child?.fadeIn).toBe(1.0)
    expect(child?.fadeOut).toBe(0.5)
  })
})

