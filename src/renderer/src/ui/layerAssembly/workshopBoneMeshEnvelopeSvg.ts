import { useEffect, useMemo, useState } from 'react'
import type { LayerBone } from '@shared/layerRig'
import type { LayerComposite } from './types'
import type { BoneTransform } from '../../engine/layerRig'
import { rotatePoint } from '../../engine/layerRig'
import { deformSkin } from '../../engine/layerSkinning'
import { computeDominantBonePerTriangle } from '../../engine/meshGeodesicSkinning'
import {
  computeAdaptiveMeshSubdivision,
  createLayerAlphaTrimmedGeometry
} from './layerAssemblyAlphaMesh'

export interface BoneMeshEnvelopeRegion {
  boneId: string
  /** Đường dẫn SVG chứa toàn bộ các tam giác Mesh thuộc về xương này (vẽ nền & lưới tam giác mịn). */
  trianglesPath: string
  /** Đường dẫn SVG viền bao ngoài bám sát nếp gấp quần áo / giày / cơ thể của bộ phận. */
  boundaryPath: string
  /** Bán kính ngang thực tế của vùng Mesh tại trung điểm xương (để đặt tay nắm và nhãn). */
  meshRadius: number
}

interface CachedLayerBaseMesh {
  width: number
  height: number
  basePositions: Float32Array
  indices: ArrayLike<number>
}

const layerMeshCache = new Map<string, CachedLayerBaseMesh>()
const pendingImageLoads = new Map<string, Array<() => void>>()
const dominantTriCache = new Map<string, string[]>()

function loadLayerBaseMesh(url: string, onLoaded: () => void): CachedLayerBaseMesh | null {
  const cached = layerMeshCache.get(url)
  if (cached) return cached

  const waiting = pendingImageLoads.get(url)
  if (waiting) {
    waiting.push(onLoaded)
    return null
  }
  pendingImageLoads.set(url, [onLoaded])

  const img = new Image()
  if (url.startsWith('http')) img.crossOrigin = 'anonymous'
  img.onload = () => {
    try {
      const width = img.naturalWidth || img.width || 256
      const height = img.naturalHeight || img.height || 256
      const sub = computeAdaptiveMeshSubdivision(width, height)
      const geom = createLayerAlphaTrimmedGeometry(width, height, img, sub.cols, sub.rows)
      const basePositions = geom.userData.basePositions as Float32Array
      const indices = geom.getIndex()?.array
      if (basePositions && indices && indices.length >= 3) {
        layerMeshCache.set(url, {
          width,
          height,
          basePositions: new Float32Array(basePositions),
          indices: Array.from(indices)
        })
      }
      geom.dispose()
    } catch {
      // Ignore decode failure
    }
    const cbs = pendingImageLoads.get(url)
    pendingImageLoads.delete(url)
    cbs?.forEach((cb) => cb())
  }
  img.onerror = () => {
    const cbs = pendingImageLoads.get(url)
    pendingImageLoads.delete(url)
    cbs?.forEach((cb) => cb())
  }
  img.src = url
  return null
}

function buildBonesKey(bones: LayerBone[]): string {
  return (
    'v4:' +
    bones
      .map(
        (b) =>
          `${b.id}:${b.parentId ?? ''}:${b.x.toFixed(1)},${b.y.toFixed(1)},${b.length.toFixed(1)},${b.angle.toFixed(1)},${(b.strength ?? 1).toFixed(2)},${(b.influenceReach ?? 1).toFixed(2)},${b.meshEnvelope ? 1 : 0}`
      )
      .join(';')
  )
}

/**
 * Tính toán phân vùng lưới Mesh thực tế (theo đúng nếp gấp quần áo, ống quần, giày, thân)
 * cho từng xương có bật `meshEnvelope: true` để hiển thị trực tiếp trên Sân khấu 2D thay cho viên nang hình học.
 */
export function useBoneMeshEnvelopeRegions(
  composite: LayerComposite | undefined,
  bones: LayerBone[],
  transforms: Map<string, BoneTransform>
): Map<string, BoneMeshEnvelopeRegion> {
  const [loadTick, setLoadTick] = useState(0)
  const anyMeshEnvelope = bones.some((b) => Boolean(b.meshEnvelope))

  useEffect(() => {
    if (!composite || !anyMeshEnvelope) return
    let active = true
    for (const layer of composite.layers) {
      if (layer.hidden) continue
      const url = layer.imageUrl || layer.asset || layer.assetPath
      if (!url) continue
      loadLayerBaseMesh(url, () => {
        if (active) setLoadTick((t) => t + 1)
      })
    }
    return () => {
      active = false
    }
  }, [composite, anyMeshEnvelope])

  return useMemo(() => {
    const result = new Map<string, BoneMeshEnvelopeRegion>()
    if (!composite || !anyMeshEnvelope || bones.length === 0) return result

    const bonesKey = buildBonesKey(bones)
    let hasDeformation = false
    for (const b of bones) {
      const tf = transforms.get(b.id)
      if (!tf) continue
      if (
        Math.abs(tf.x - b.x) > 0.1 ||
        Math.abs(tf.y - b.y) > 0.1 ||
        Math.abs(tf.rotation) > 0.1
      ) {
        hasDeformation = true
        break
      }
    }

    const triPartsByBone = new Map<string, string[]>()
    const boundaryEdgesByBone = new Map<string, Map<string, [number, number, number, number]>>()
    const maxPerpByBone = new Map<string, number>()

    for (const b of bones) {
      if (b.meshEnvelope) {
        triPartsByBone.set(b.id, [])
        boundaryEdgesByBone.set(b.id, new Map())
        maxPerpByBone.set(b.id, 18)
      }
    }

    for (const layer of composite.layers) {
      if (layer.hidden) continue
      const url = layer.imageUrl || layer.asset || layer.assetPath
      if (!url) continue
      const mesh = layerMeshCache.get(url)
      if (!mesh) continue

      const { basePositions, indices } = mesh
      const vCount = basePositions.length / 3
      const scale = layer.scale ?? 1
      const sx = scale * (layer.scaleX ?? 1)
      const sy = scale * (layer.scaleY ?? 1)
      const rot = layer.rotation ?? 0
      const bx = layer.x ?? 0
      const by = layer.y ?? 0

      const restWorld = new Float32Array(vCount * 2)
      for (let i = 0; i < vCount; i++) {
        const p = rotatePoint(basePositions[i * 3] * sx, -basePositions[i * 3 + 1] * sy, rot)
        restWorld[i * 2] = p.x + bx
        restWorld[i * 2 + 1] = p.y + by
      }

      const domCacheKey = `${layer.id}|${vCount}|${indices.length}|${bx.toFixed(1)},${by.toFixed(1)},${rot.toFixed(1)},${sx.toFixed(3)},${sy.toFixed(3)}|${bonesKey}`
      let dominant = dominantTriCache.get(domCacheKey)
      if (!dominant) {
        dominant = computeDominantBonePerTriangle(restWorld, bones, indices)
        dominantTriCache.set(domCacheKey, dominant)
        if (dominantTriCache.size > 48) {
          const firstKey = dominantTriCache.keys().next().value
          if (firstKey !== undefined) dominantTriCache.delete(firstKey)
        }
      }

      let displayWorld = restWorld
      if (hasDeformation && composite.rig) {
        const tempTracks: LayerComposite['rig'] extends undefined ? never : NonNullable<LayerComposite['rig']>['tracks'] = {}
        for (const b of bones) {
          const tf = transforms.get(b.id)
          if (!tf) continue
          const parentTf = b.parentId ? transforms.get(b.parentId) : undefined
          const localRot = tf.rotation - (parentTf?.rotation ?? 0)
          if (Math.abs(localRot) > 0.05) {
            tempTracks[b.id] = [{ time: 0, x: 0, y: 0, rotation: localRot, easing: 'linear' }]
          }
        }
        const deformedLocal = deformSkin(
          basePositions,
          {
            boneId: bones[0].id,
            extraBoneIds: bones.slice(1).map((b) => b.id),
            x: bx,
            y: by,
            rotation: rot,
            scale,
            scaleX: layer.scaleX,
            scaleY: layer.scaleY,
            bindPose: { x: bx, y: by, rotation: rot }
          },
          { duration: 1, loop: false, bones, tracks: tempTracks },
          0,
          indices
        )
        displayWorld = new Float32Array(vCount * 2)
        for (let i = 0; i < vCount; i++) {
          const p = rotatePoint(deformedLocal[i * 3] * sx, -deformedLocal[i * 3 + 1] * sy, rot)
          displayWorld[i * 2] = p.x + bx
          displayWorld[i * 2 + 1] = p.y + by
        }
      }

      const triCount = Math.floor(indices.length / 3)
      for (let t = 0; t < triCount; t++) {
        const boneId = dominant[t]
        const triList = triPartsByBone.get(boneId)
        const edgeMap = boundaryEdgesByBone.get(boneId)
        if (!triList || !edgeMap) continue

        const i0 = indices[t * 3]
        const i1 = indices[t * 3 + 1]
        const i2 = indices[t * 3 + 2]
        const x0 = displayWorld[i0 * 2], y0 = displayWorld[i0 * 2 + 1]
        const x1 = displayWorld[i1 * 2], y1 = displayWorld[i1 * 2 + 1]
        const x2 = displayWorld[i2 * 2], y2 = displayWorld[i2 * 2 + 1]

        triList.push(
          `M${x0.toFixed(1)} ${y0.toFixed(1)}L${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}Z`
        )

        const edges: Array<[number, number, number, number, number, number]> = [
          [i0, i1, x0, y0, x1, y1],
          [i1, i2, x1, y1, x2, y2],
          [i2, i0, x2, y2, x0, y0]
        ]
        for (const [u, v, ax, ay, bxEdge, byEdge] of edges) {
          const k = u < v ? `${u}_${v}` : `${v}_${u}`
          if (edgeMap.has(k)) {
            edgeMap.delete(k)
          } else {
            edgeMap.set(k, [ax, ay, bxEdge, byEdge])
          }
        }
      }
    }

    for (const bone of bones) {
      if (!bone.meshEnvelope) continue
      const triList = triPartsByBone.get(bone.id)
      const edgeMap = boundaryEdgesByBone.get(bone.id)
      if (!triList || triList.length === 0 || !edgeMap) continue

      const tf = transforms.get(bone.id)
      const angle = bone.angle + (tf?.rotation ?? 0)
      const end = rotatePoint(bone.length, 0, angle)
      const hx = tf?.x ?? bone.x
      const hy = tf?.y ?? bone.y
      const len = Math.max(1, bone.length)
      const nx = -end.y / len
      const ny = end.x / len
      const midX = hx + end.x * 0.5
      const midY = hy + end.y * 0.5

      let maxPerp = 18
      const boundaryParts: string[] = []
      for (const [ax, ay, bxEdge, byEdge] of edgeMap.values()) {
        boundaryParts.push(`M${ax.toFixed(1)} ${ay.toFixed(1)}L${bxEdge.toFixed(1)} ${byEdge.toFixed(1)}`)
        const dMid = Math.abs((ax - midX) * (end.x / len) + (ay - midY) * (end.y / len))
        if (dMid <= len * 0.35) {
          const perp = Math.abs((ax - midX) * nx + (ay - midY) * ny)
          if (perp > maxPerp) maxPerp = perp
        }
      }

      result.set(bone.id, {
        boneId: bone.id,
        trianglesPath: triList.join(''),
        boundaryPath: boundaryParts.join(''),
        meshRadius: Math.min(140, Math.max(20, maxPerp))
      })
    }

    return result
  }, [composite, bones, transforms, anyMeshEnvelope, loadTick])
}
