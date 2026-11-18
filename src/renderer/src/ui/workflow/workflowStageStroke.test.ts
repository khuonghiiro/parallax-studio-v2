import { describe, expect, it } from 'vitest'
import { stageStrokeToMotionPath } from './workflowStageStroke'
import { createImageLayer, createProject } from '../../project/factory'
import { bakeCustomMotionPathToScene } from '../../project/workflowV2PartAndPathBake'
import { evaluate } from '../../animation/keyframes'

describe('drawing Motion on the BBox stage', () => {
  it.each([0.2, 0.5, 1, 1.5])('preserves stage distance and Y direction at zoom %s', (zoom) => {
    const perspective = 0.8
    const path = stageStrokeToMotionPath(
      [
        [200, 100],
        [160, 180],
        [320, 40]
      ],
      zoom,
      perspective
    )
    expect(path[0]).toEqual([0, 0])
    expect(path[1][0] * zoom * perspective).toBeCloseTo(-40, 2)
    expect(-path[1][1] * zoom * perspective).toBeCloseTo(80, 2)
    expect(path[2][0] * zoom * perspective).toBeCloseTo(120, 2)
    expect(-path[2][1] * zoom * perspective).toBeCloseTo(-60, 2)
  })

  it('bakes the drawn endpoint at the actual layer position and supports redrawing', () => {
    const project = createProject()
    const layer = createImageLayer(
      { id: 'draw', name: 'Draw', kind: 'image', mime: 'image/png', width: 200, height: 200 },
      project.comp,
      300
    )
    layer.transform.position.value = [120, 80, 300]
    project.layers.push(layer)
    const path = stageStrokeToMotionPath(
      [
        [10, 10],
        [110, 50]
      ],
      0.5,
      0.8
    )
    const options = { nodeId: 'stage-path', timeStart: 0, timeEnd: 2, intensity: 1 }
    bakeCustomMotionPathToScene(project, [layer.id], path, options)
    expect(evaluate(layer.transform.position, 2)).toEqual([370, -20, 300])
    bakeCustomMotionPathToScene(project, [layer.id], path, options)
    expect(evaluate(layer.transform.position, 2)).toEqual([370, -20, 300])
  })

  it('bakes target Scale and 3D Rotation at the end of a freehand drawn path', () => {
    const project = createProject()
    const layer = createImageLayer(
      { id: 'hero', name: 'Hero', kind: 'image', mime: 'image/png', width: 240, height: 360 },
      project.comp,
      0
    )
    layer.transform.position.value = [-200, -60, 0]
    layer.transform.scale.value = [0.8, 0.8, 1]
    layer.transform.rotation.value = [0, 0, 5]
    project.layers.push(layer)

    const freehandPath: [number, number][] = [
      [0, 0],
      [120, 90],
      [260, 40],
      [400, -20]
    ]
    bakeCustomMotionPathToScene(project, [layer.id], freehandPath, {
      nodeId: 'v2-free-path',
      timeStart: 0,
      timeEnd: 3,
      intensity: 1,
      targetScalePct: 150,
      targetRotZ: -25,
      targetRotY: 15
    })

    expect(evaluate(layer.transform.position, 3)).toEqual([200, -80, 0])
    const endScale = evaluate(layer.transform.scale, 3)
    expect(endScale[0]).toBeCloseTo(1.2, 2)
    expect(endScale[1]).toBeCloseTo(1.2, 2)
    const endRot = evaluate(layer.transform.rotation, 3)
    expect(endRot[2]).toBeCloseTo(-20, 1)
    expect(endRot[1]).toBeCloseTo(15, 1)
  })

  it('does not turn a click or tiny stroke into a normalized legacy path', () => {
    expect(stageStrokeToMotionPath([[1, 1]], 1, 1)).toEqual([])
    expect(
      stageStrokeToMotionPath(
        [
          [1, 1],
          [1.1, 1.1]
        ],
        1,
        1
      )
    ).toEqual([])
  })
})
