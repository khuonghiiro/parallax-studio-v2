import type { Layer, Vec3 } from '@shared/types'

/** Scale the assembly, including its authored tracks and rest-pose metadata. */
export function scaleClusterFromSnapshot(
  members: Layer[], sources: readonly Layer[], pivot: Vec3, ratio: number
): void {
  if (!Number.isFinite(ratio) || ratio <= 0) return
  const point = (v: Vec3): Vec3 => v.map((n, axis) => pivot[axis] + (n - pivot[axis]) * ratio) as Vec3
  const vector = (v: Vec3): Vec3 => v.map(n => n * ratio) as Vec3
  for (const layer of members) {
    const source = sources.find(l => l.id === layer.id)
    if (!source || layer.locked) continue
    layer.transform.position.value = point(source.transform.position.value)
    layer.transform.position.keyframes = source.transform.position.keyframes.map(k => ({ ...k, value: point(k.value) }))
    layer.transform.scale.value = vector(source.transform.scale.value)
    layer.transform.scale.keyframes = source.transform.scale.keyframes.map(k => ({ ...k, value: vector(k.value) }))
    if (layer.composite && source.composite) {
      if (source.composite.rootOffset) layer.composite.rootOffset = vector(source.composite.rootOffset)
      if (source.composite.centerPosition) layer.composite.centerPosition = point(source.composite.centerPosition)
    }
    if (layer.model3d && source.model3d) {
      layer.model3d.globalScale = source.model3d.globalScale * ratio
      if (source.model3d.centerPosition) layer.model3d.centerPosition = point(source.model3d.centerPosition)
    }
  }
}
