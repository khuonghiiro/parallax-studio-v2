import * as THREE from 'three'
import type { EvaluatedScene } from './evaluateScene'

const _vCorner = new THREE.Vector3()
const _vCenter = new THREE.Vector3()
const _vSize = new THREE.Vector3()
const _boxCluster = new THREE.Box3()
const _mInvShot = new THREE.Matrix4()
const _mNodeLocal = new THREE.Matrix4()
const _mLocal = new THREE.Matrix4()
const _mScale = new THREE.Matrix4()
const _outMatrix = new THREE.Matrix4()

export const OUTLINE_PLANE_CORNERS: readonly [number, number][] = [
  [-0.5, -0.5],
  [0.5, -0.5],
  [0.5, 0.5],
  [-0.5, 0.5]
]

/**
 * Computes the 3D transform matrix for the selection outline of a locked 2.5D / 3D cluster.
 * Returns null if the selected layer is not part of a locked cluster, or scope is 'layer'.
 */
export function computeClusterOutlineMatrix(
  selectedId: string | null | undefined,
  scope: 'cluster' | 'layer' | undefined,
  scene: EvaluatedScene | null | undefined,
  getNodeMatrix: (layerId: string) => THREE.Matrix4 | null | undefined
): THREE.Matrix4 | null {
  if (!selectedId || !scene) return null

  const selEl = scene.layers.find((l) => l.layer.id === selectedId)
  if (!selEl) return null

  const layer = selEl.layer
  const cluster = layer.composite ?? layer.model3d
  const isCluster = scope !== 'layer' && Boolean(cluster && cluster.lockedGroup !== false)
  if (!isCluster) return null

  const compInstanceId = layer.composite?.instanceId
  const modelInstanceId = layer.model3d?.instanceId
  const groupLayers = scene.layers.filter(
    (l) =>
      (compInstanceId && l.layer.composite?.instanceId === compInstanceId) ||
      (modelInstanceId && l.layer.model3d?.instanceId === modelInstanceId)
  )
  if (groupLayers.length === 0) return null

  const shotMat = selEl.shot?.matrix
  const invShot = shotMat ? _mInvShot.copy(shotMat).invert() : null
  _boxCluster.makeEmpty()

  for (const gl of groupLayers) {
    if (!gl.active) continue
    const nodeMat = getNodeMatrix(gl.layer.id)
    if (nodeMat) {
      const localMat = invShot ? _mNodeLocal.multiplyMatrices(invShot, nodeMat) : nodeMat
      for (const [px, py] of OUTLINE_PLANE_CORNERS) {
        _vCorner.set(px, py, 0).applyMatrix4(localMat)
        _boxCluster.expandByPoint(_vCorner)
      }
    } else if (!gl.bounds.isEmpty()) {
      if (invShot) {
        const b = gl.bounds
        for (let i = 0; i < 8; i++) {
          _vCorner.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z)
          _vCorner.applyMatrix4(invShot)
          _boxCluster.expandByPoint(_vCorner)
        }
      } else {
        _boxCluster.union(gl.bounds)
      }
    }
  }

  if (_boxCluster.isEmpty()) {
    if (!selEl.bounds.isEmpty()) {
      if (invShot) {
        const b = selEl.bounds
        for (let i = 0; i < 8; i++) {
          _vCorner.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z)
          _vCorner.applyMatrix4(invShot)
          _boxCluster.expandByPoint(_vCorner)
        }
      } else {
        _boxCluster.copy(selEl.bounds)
      }
    }
  }

  if (_boxCluster.isEmpty()) return null

  const center = _boxCluster.getCenter(_vCenter)
  const size = _boxCluster.getSize(_vSize)
  _mLocal.makeTranslation(center.x, center.y, center.z)
  _mLocal.multiply(_mScale.makeScale(Math.max(1, size.x), Math.max(1, size.y), 1))

  if (shotMat) {
    _outMatrix.multiplyMatrices(shotMat, _mLocal)
  } else {
    _outMatrix.copy(_mLocal)
  }
  return _outMatrix
}
