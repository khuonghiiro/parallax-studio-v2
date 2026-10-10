import type { ImageLayer, Vec3 } from '@shared/types'
import { evaluateRig, transformRigLayer } from '../../engine/layerRig'
import type { AssembledLayerItem, LayerComposite } from './types'

/** Bake into native project tracks so preview, saved projects and MP4 use the same motion. */
export function bakeWorkshopRig(layer: ImageLayer, item: AssembledLayerItem, composite: LayerComposite,
  duration: number, fps: number, scale: number, offset: Vec3): void {
  if (!composite.rig || !item.boneId || item.bindingMode === 'soft') return
  const frames = Math.ceil(duration * fps)
  for (let frame = 0; frame <= frames; frame++) {
    const t = Math.min(duration, frame / fps)
    const posed = transformRigLayer(item, evaluateRig(composite.rig, t))
    const position: Vec3 = [posed.x * scale + offset[0], -posed.y * scale + offset[1], posed.z * scale + offset[2]]
    const rotation: Vec3 = [posed.rotationX ?? 0, posed.rotationY ?? 0, posed.rotation]
    layer.transform.position.keyframes.push({ id: `${layer.id}-rig-p-${frame}`, t, value: position, ease: 'linear' })
    layer.transform.rotation.keyframes.push({ id: `${layer.id}-rig-r-${frame}`, t, value: rotation, ease: 'linear' })
  }
  layer.transform.position.value = layer.transform.position.keyframes[0].value
  layer.transform.rotation.value = layer.transform.rotation.keyframes[0].value
}
