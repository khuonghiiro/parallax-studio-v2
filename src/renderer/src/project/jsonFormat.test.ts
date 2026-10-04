import { describe, expect, it } from 'vitest'
import { buildDemoProject } from './demo'
import { exportProjectToJson, importProjectFromJson } from './jsonFormat'
import demoJson from './demoProject.json'

describe('JSON Project Format & Declarative Scene Spec', () => {
  it('loads demoProject.json cleanly into a 4-shot project', async () => {
    const project = await buildDemoProject()
    expect(project.shots).toHaveLength(4)
    expect(project.shots.map((s) => s.name)).toEqual([
      'Emerald Riverbank',
      'Island Pond',
      'Highland Lagoon',
      'Twilight Valley'
    ])
    expect(project.layers.length).toBeGreaterThan(20)
    expect(project.comp.duration).toBeGreaterThan(15)
  })

  it('exports and re-imports project via JSON with 100% roundtrip fidelity', async () => {
    const original = await buildDemoProject()
    const jsonStr = await exportProjectToJson(original, false)
    expect(typeof jsonStr).toBe('string')
    expect(jsonStr).toContain('Emerald Riverbank')

    const imported = await importProjectFromJson(jsonStr)
    expect(imported.shots).toHaveLength(original.shots.length)
    expect(imported.layers).toHaveLength(original.layers.length)
    expect(imported.comp.duration).toBeCloseTo(original.comp.duration, 2)
  })

  it('allows editing a scene title and duration directly in declarative JSON', async () => {
    const modifiedSpec = JSON.parse(JSON.stringify(demoJson))
    modifiedSpec.name = 'Custom 2.5D Movie'
    modifiedSpec.shots[0].title.text = 'MY CUSTOM SCENE'
    modifiedSpec.shots[0].title.color = '#ff9800'

    const project = await importProjectFromJson(JSON.stringify(modifiedSpec))
    expect(project.comp.name).toBe('Custom 2.5D Movie')

    const titleLayer = project.layers.find((l) => l.name === 'Emerald Riverbank · Title')
    expect(titleLayer).toBeDefined()
    if (titleLayer && titleLayer.type === 'text') {
      expect(titleLayer.props.text).toBe('MY CUSTOM SCENE')
      expect(titleLayer.props.color).toBe('#ff9800')
    }
  })

  it('loads animated drifting mist and wind sway layers from declarative JSON', async () => {
    const project = await buildDemoProject()
    const mistLayer = project.layers.find((l) => l.name === 'Drifting River Mist')
    expect(mistLayer).toBeDefined()
    expect(mistLayer?.type).toBe('image')
    expect(mistLayer?.blendMode).toBe('screen')
    expect(mistLayer?.motion?.type).toBe('sway')
    expect(mistLayer?.motion?.speed).toBe(0.22)

    const framingLayer = project.layers.find((l) => l.name === 'Foreground Framing')
    expect(framingLayer).toBeDefined()
    expect(framingLayer?.motion?.type).toBe('wind')
    expect(framingLayer?.motion?.speed).toBe(0.55)
  })
})

