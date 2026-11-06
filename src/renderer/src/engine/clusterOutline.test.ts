import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { computeClusterOutlineMatrix } from './clusterOutline'
import type { EvaluatedScene, EvaluatedLayer } from './evaluateScene'
import type { Layer } from '@shared/types'

function makeTestLayer(id: string, opts?: { instanceId?: string; isRoot?: boolean; lockedGroup?: boolean }): Layer {
  return {
    id,
    name: id,
    type: 'image',
    shotId: 'shot-1',
    visible: true,
    locked: false,
    autoScale: false,
    inPoint: 0,
    outPoint: 10,
    blendMode: 'normal',
    props: { assetId: 'test-asset', width: 100, height: 100 },
    transform: {
      position: { value: [0, 0, 0], keyframes: [] },
      scale: { value: [1, 1, 1], keyframes: [] },
      rotation: { value: [0, 0, 0], keyframes: [] },
      opacity: { value: 1, keyframes: [] }
    },
    composite: opts?.instanceId
      ? {
          instanceId: opts.instanceId,
          compositeId: 'comp-1',
          compositeName: 'Character',
          isRoot: opts.isRoot ?? false,
          lockedGroup: opts.lockedGroup ?? true
        }
      : undefined
  }
}

function makeEvaluatedLayer(
  layer: Layer,
  pos: [number, number, number],
  size: [number, number],
  shotMatrix?: THREE.Matrix4
): EvaluatedLayer {
  const world = new THREE.Matrix4().makeTranslation(pos[0], pos[1], pos[2])
  if (shotMatrix) {
    world.premultiply(shotMatrix)
  }
  const min = new THREE.Vector3(pos[0] - size[0] / 2, pos[1] - size[1] / 2, pos[2] - 0.5)
  const max = new THREE.Vector3(pos[0] + size[0] / 2, pos[1] + size[1] / 2, pos[2] + 0.5)
  const bounds = new THREE.Box3(min, max)

  return {
    layer,
    active: true,
    opacity: 1,
    bounds,
    world,
    worldPosition: [pos[0], pos[1], -pos[2]],
    position: pos,
    size,
    scale: [1, 1, 1],
    rotation: [0, 0, 0],
    index: 0,
    shot: shotMatrix
      ? {
          shot: { id: 'shot-1' } as any,
          matrix: shotMatrix,
          index: 0,
          bounds: new THREE.Box3(),
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          layerCount: 2
        }
      : null
  }
}

function makeEmptyScene(layers: EvaluatedLayer[] = []): EvaluatedScene {
  return {
    layers,
    shots: [],
    camera: {
      position: [0, 0, 1000],
      target: [0, 0, 0],
      fov: 45,
      focusDistance: 1000,
      aperture: 0.1,
      dof: false,
      fade: 0
    },
    t: 0
  }
}

describe('computeClusterOutlineMatrix', () => {
  it('returns null when selectedId is null or missing', () => {
    const scene = makeEmptyScene()
    expect(computeClusterOutlineMatrix(null, 'cluster', scene, () => null)).toBeNull()
    expect(computeClusterOutlineMatrix(undefined, 'cluster', scene, () => null)).toBeNull()
  })

  it('returns null when layer is not part of a locked cluster', () => {
    const l1 = makeTestLayer('l1')
    const el1 = makeEvaluatedLayer(l1, [0, 0, 0], [100, 100])
    const scene = makeEmptyScene([el1])

    expect(computeClusterOutlineMatrix('l1', 'cluster', scene, () => null)).toBeNull()
  })

  it('returns null when scope is "layer" so individual layer selection outline is used', () => {
    const l1 = makeTestLayer('l1', { instanceId: 'char-1', lockedGroup: true })
    const el1 = makeEvaluatedLayer(l1, [0, 0, 0], [100, 100])
    const scene = makeEmptyScene([el1])

    expect(computeClusterOutlineMatrix('l1', 'layer', scene, () => null)).toBeNull()
  })

  it('returns null when cluster lockedGroup is explicitly false', () => {
    const l1 = makeTestLayer('l1', { instanceId: 'char-1', lockedGroup: false })
    const el1 = makeEvaluatedLayer(l1, [0, 0, 0], [100, 100])
    const scene = makeEmptyScene([el1])

    expect(computeClusterOutlineMatrix('l1', 'cluster', scene, () => null)).toBeNull()
  })

  it('computes bounding outline matrix for all member layers in a locked cluster', () => {
    // Character composed of body [-50..50, -50..50] and head [-30..30, 50..110]
    const body = makeTestLayer('body', { instanceId: 'char-1', isRoot: true, lockedGroup: true })
    const head = makeTestLayer('head', { instanceId: 'char-1', isRoot: false, lockedGroup: true })

    const elBody = makeEvaluatedLayer(body, [0, 0, 10], [100, 100])
    const elHead = makeEvaluatedLayer(head, [0, 80, 12], [60, 60])

    const nodeMatrices = new Map<string, THREE.Matrix4>([
      ['body', new THREE.Matrix4().makeTranslation(0, 0, 10).multiply(new THREE.Matrix4().makeScale(100, 100, 1))],
      ['head', new THREE.Matrix4().makeTranslation(0, 80, 12).multiply(new THREE.Matrix4().makeScale(60, 60, 1))]
    ])

    const scene = makeEmptyScene([elBody, elHead])

    const matrix = computeClusterOutlineMatrix('body', 'cluster', scene, (id) => nodeMatrices.get(id))
    expect(matrix).not.toBeNull()

    // Bounding box:
    // X goes from -50 to +50 -> width = 100, center X = 0
    // Y goes from -50 (body bottom) to 80 + 30 = 110 (head top) -> height = 160, center Y = 30
    const pos = new THREE.Vector3()
    const scale = new THREE.Vector3()
    const quat = new THREE.Quaternion()
    matrix!.decompose(pos, quat, scale)

    expect(pos.x).toBeCloseTo(0)
    expect(pos.y).toBeCloseTo(30)
    expect(scale.x).toBeCloseTo(100)
    expect(scale.y).toBeCloseTo(160)
  })

  it('correctly applies shot transform matrix to the cluster outline', () => {
    const shotMatrix = new THREE.Matrix4().makeTranslation(1000, 200, 0)
    const body = makeTestLayer('body', { instanceId: 'char-1', isRoot: true, lockedGroup: true })
    const elBody = makeEvaluatedLayer(body, [0, 0, 10], [100, 100], shotMatrix)

    const nodeMatrix = new THREE.Matrix4()
      .copy(shotMatrix)
      .multiply(new THREE.Matrix4().makeTranslation(0, 0, 10))
      .multiply(new THREE.Matrix4().makeScale(100, 100, 1))

    const scene = makeEmptyScene([elBody])

    const matrix = computeClusterOutlineMatrix('body', 'cluster', scene, () => nodeMatrix)
    expect(matrix).not.toBeNull()

    const pos = new THREE.Vector3()
    const scale = new THREE.Vector3()
    const quat = new THREE.Quaternion()
    matrix!.decompose(pos, quat, scale)

    expect(pos.x).toBeCloseTo(1000)
    expect(pos.y).toBeCloseTo(200)
    expect(scale.x).toBeCloseTo(100)
    expect(scale.y).toBeCloseTo(100)
  })

  it('falls back to gl.bounds if node matrices are not provided', () => {
    const body = makeTestLayer('body', { instanceId: 'char-1', isRoot: true, lockedGroup: true })
    const elBody = makeEvaluatedLayer(body, [150, 80, 0], [120, 200])

    const scene = makeEmptyScene([elBody])

    // Pass getNodeMatrix returning null
    const matrix = computeClusterOutlineMatrix('body', 'cluster', scene, () => null)
    expect(matrix).not.toBeNull()

    const pos = new THREE.Vector3()
    const scale = new THREE.Vector3()
    const quat = new THREE.Quaternion()
    matrix!.decompose(pos, quat, scale)

    expect(pos.x).toBeCloseTo(150)
    expect(pos.y).toBeCloseTo(80)
    expect(scale.x).toBeCloseTo(120)
    expect(scale.y).toBeCloseTo(200)
  })
})
