import { duplicateLayer } from '../../project/factory'
import { addKeyframe, evaluate } from '../../animation/keyframes'
import { frameTolerance, useEditor } from '../../store/editor'
import { useToast } from '../../actions'

const toast = (m: string): void => useToast.getState().show(m)

/** Split the currently selected layer into two contiguous segments at current time or targetTime */
export function splitSelectedLayer(targetTime?: number): boolean {
  const st = useEditor.getState()
  const { selectedLayerId, project } = st
  if (!selectedLayerId) {
    toast('Hãy chọn một layer cần cắt trước')
    return false
  }

  const layer = project.layers.find((l) => l.id === selectedLayerId)
  if (!layer) return false
  if (layer.locked) {
    toast('Layer đang bị khóa, hãy mở khóa trước khi cắt')
    return false
  }

  const t = targetTime ?? st.time
  const fps = project.comp.fps
  const minSpan = 1 / fps

  if (t <= layer.inPoint + minSpan || t >= layer.outPoint - minSpan) {
    toast(`Kim thời gian phải nằm giữa thời điểm hiển thị (${layer.inPoint.toFixed(2)}s → ${layer.outPoint.toFixed(2)}s)`)
    return false
  }

  const copy = duplicateLayer(layer)
  copy.inPoint = t
  copy.outPoint = layer.outPoint
  copy.name = `${layer.name} (phần 2)`

  const idx = project.layers.findIndex((l) => l.id === selectedLayerId)

  st.update((d) => {
    const orig = d.layers.find((l) => l.id === selectedLayerId)
    if (orig) orig.outPoint = t
    d.layers.splice(idx + 1, 0, copy)
  })

  st.selectLayer(copy.id)
  toast(`✂ Đã tách layer thành 2 đoạn tại ${t.toFixed(2)}s`)
  return true
}

/** Set In-point of the selected layer to current time */
export function setSelectedLayerInPoint(targetTime?: number): boolean {
  const st = useEditor.getState()
  const { selectedLayerId, project } = st
  if (!selectedLayerId) {
    toast('Hãy chọn một layer trước')
    return false
  }
  const layer = project.layers.find((l) => l.id === selectedLayerId)
  if (!layer) return false
  if (layer.locked) {
    toast('Layer đang bị khóa')
    return false
  }

  const t = targetTime ?? st.time
  const minSpan = 1 / project.comp.fps
  if (t >= layer.outPoint - minSpan) {
    toast('Điểm bắt đầu [In] phải trước điểm kết thúc [Out]')
    return false
  }

  st.update((d) => {
    const l = d.layers.find((x) => x.id === selectedLayerId)
    if (l) l.inPoint = t
  })
  toast(`[ Đã đặt điểm bắt đầu [In] tại ${t.toFixed(2)}s`)
  return true
}

/** Set Out-point of the selected layer to current time */
export function setSelectedLayerOutPoint(targetTime?: number): boolean {
  const st = useEditor.getState()
  const { selectedLayerId, project } = st
  if (!selectedLayerId) {
    toast('Hãy chọn một layer trước')
    return false
  }
  const layer = project.layers.find((l) => l.id === selectedLayerId)
  if (!layer) return false
  if (layer.locked) {
    toast('Layer đang bị khóa')
    return false
  }

  const t = targetTime ?? st.time
  const minSpan = 1 / project.comp.fps
  if (t <= layer.inPoint + minSpan) {
    toast('Điểm kết thúc [Out] phải sau điểm bắt đầu [In]')
    return false
  }

  st.update((d) => {
    const l = d.layers.find((x) => x.id === selectedLayerId)
    if (l) l.outPoint = t
  })
  toast(`] Đã đặt điểm kết thúc [Out] tại ${t.toFixed(2)}s`)
  return true
}

/** Add a keyframe for position/opacity at current time on selected layer */
export function addKeyframeForSelectedLayer(targetTime?: number): boolean {
  const st = useEditor.getState()
  const { selectedLayerId, project } = st
  if (!selectedLayerId) {
    toast('Hãy chọn một layer trước khi tạo Keyframe')
    return false
  }
  const layer = project.layers.find((l) => l.id === selectedLayerId)
  if (!layer) return false
  if (layer.locked) {
    toast('Layer đang bị khóa')
    return false
  }

  const t = targetTime ?? st.time
  const tol = frameTolerance(project)

  st.update((d) => {
    const l = d.layers.find((x) => x.id === selectedLayerId)
    if (!l) return
    const curPos = evaluate(l.transform.position, t)
    addKeyframe(l.transform.position, t, curPos, 'easeInOut', tol)
  })

  toast(`◆ Đã thêm Keyframe vị trí tại ${t.toFixed(2)}s`)
  return true
}

/** Reset in/out points to fill whole composition duration */
export function resetSelectedLayerTiming(): boolean {
  const st = useEditor.getState()
  const { selectedLayerId, project } = st
  if (!selectedLayerId) return false
  st.update((d) => {
    const l = d.layers.find((x) => x.id === selectedLayerId)
    if (l) {
      l.inPoint = 0
      l.outPoint = project.comp.duration
    }
  })
  toast('Đã phục hồi thời lượng layer toàn cảnh')
  return true
}
