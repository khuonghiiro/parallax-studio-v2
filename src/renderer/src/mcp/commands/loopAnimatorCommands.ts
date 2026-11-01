import type { Handler, Params } from '../types'
import { str, num, bool } from '../params'
import { useView } from '../../store/view'
import { useLoopAnimator } from '../../ui/loopAnimator/loopAnimatorState'
import { applyLoopAnimationToProject } from '../../ui/loopAnimator/loopAnimationExporter'
import { BUILTIN_LOOP_PRESETS } from '../../ui/loopAnimator/sampleLoops'
import type { LoopMode, GridOrder, ChromaKeyColorType } from '../../ui/loopAnimator/types'

export const loopAnimatorCommands: Record<string, Handler> = {
  open_loop_animator: async (p: Params) => {
    const presetId = str(p, 'preset_id')
    const imageUrl = str(p, 'image_url')
    const rows = num(p, 'rows')
    const cols = num(p, 'cols')
    const chroma = bool(p, 'chroma')
    const keyColor = str(p, 'key_color')

    const animator = useLoopAnimator.getState()

    if (presetId) {
      const found = BUILTIN_LOOP_PRESETS.find((x) => x.id === presetId)
      if (found) {
        animator.open(found)
      } else {
        animator.open(presetId)
      }
    } else if (imageUrl) {
      animator.open(imageUrl)
    } else {
      animator.open()
    }

    if (rows !== undefined || cols !== undefined) {
      animator.setGridConfig({
        ...(rows !== undefined ? { rows } : {}),
        ...(cols !== undefined ? { cols } : {})
      })
    }

    if (chroma !== undefined) {
      animator.setChromaConfig({
        enabled: chroma,
        ...(keyColor ? { keyColorType: keyColor as ChromaKeyColorType } : {})
      })
    }

    useView.getState().openDialog('loop_animator')

    const s = useLoopAnimator.getState()
    return {
      ok: true,
      is_open: true,
      name: s.name,
      image_url: s.imageUrl,
      frames_count: s.frames.length,
      fps: s.playback.fps,
      loop_mode: s.playback.loopMode
    }
  },

  close_loop_animator: async () => {
    useLoopAnimator.getState().close()
    useView.getState().openDialog(null)
    return { ok: true, is_open: false }
  },

  get_loop_animator_state: async () => {
    const s = useLoopAnimator.getState()
    const viewDialog = useView.getState().dialog
    return {
      ok: true,
      is_open: viewDialog === 'loop_animator' && s.isOpen,
      name: s.name,
      image_url: s.imageUrl,
      image_dimensions: s.imageNaturalSize,
      slicer_mode: s.slicerMode,
      grid_config: s.gridConfig,
      chroma_config: s.chromaConfig,
      frames_count: s.frames.length,
      enabled_frames_count: s.frames.filter((f) => f.enabled).length,
      selected_frame_index: s.selectedFrameIndex,
      playback: s.playback,
      frames: s.frames.map((f) => ({
        id: f.id,
        index: f.index,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        enabled: f.enabled,
        duration_multiplier: f.durationMultiplier,
        offset_x: f.offsetX,
        offset_y: f.offsetY,
        label: f.label
      }))
    }
  },

  configure_loop_chroma: async (p: Params) => {
    const enabled = bool(p, 'enabled')
    const keyColorType = str(p, 'key_color_type') as ChromaKeyColorType | undefined
    const customHex = str(p, 'custom_hex')
    const tolerance = num(p, 'tolerance')
    const smoothness = num(p, 'smoothness')
    const despill = num(p, 'despill')

    const animator = useLoopAnimator.getState()
    animator.setChromaConfig({
      ...(enabled !== undefined ? { enabled } : {}),
      ...(keyColorType ? { keyColorType } : {}),
      ...(customHex ? { customHex } : {}),
      ...(tolerance !== undefined ? { tolerance } : {}),
      ...(smoothness !== undefined ? { smoothness } : {}),
      ...(despill !== undefined ? { despill } : {})
    })

    return {
      ok: true,
      chroma_config: useLoopAnimator.getState().chromaConfig
    }
  },

  split_loop_frames: async (p: Params) => {
    const mode = str(p, 'mode')
    const rows = num(p, 'rows')
    const cols = num(p, 'cols')
    const padding = num(p, 'padding')
    const order = str(p, 'order') as GridOrder | undefined

    const animator = useLoopAnimator.getState()
    if (mode === 'grid' || mode === 'contour') {
      animator.setSlicerMode(mode)
    }

    if (rows !== undefined || cols !== undefined || padding !== undefined || order) {
      animator.setGridConfig({
        ...(rows !== undefined ? { rows } : {}),
        ...(cols !== undefined ? { cols } : {}),
        ...(padding !== undefined ? { paddingInset: padding } : {}),
        ...(order ? { order } : {})
      })
    } else {
      animator.autoGenerateGridFrames()
    }

    return {
      ok: true,
      frames_count: useLoopAnimator.getState().frames.length
    }
  },

  reorder_loop_frames: async (p: Params) => {
    const action = str(p, 'action') || 'reverse'
    const fromIndex = num(p, 'from_index')
    const toIndex = num(p, 'to_index')
    const targetIndex = num(p, 'target_index')

    const animator = useLoopAnimator.getState()

    switch (action) {
      case 'reverse':
        animator.reverseFrames()
        break
      case 'ping_pong':
        animator.expandPingPong()
        break
      case 'move':
        if (fromIndex !== undefined && toIndex !== undefined) {
          animator.reorderFrames(fromIndex, toIndex)
        }
        break
      case 'duplicate':
        if (targetIndex !== undefined) {
          animator.duplicateFrame(targetIndex)
        }
        break
      case 'delete':
        if (targetIndex !== undefined) {
          animator.deleteFrame(targetIndex)
        }
        break
      default:
        break
    }

    return {
      ok: true,
      frames_count: useLoopAnimator.getState().frames.length,
      frames: useLoopAnimator.getState().frames.map((f) => ({ id: f.id, index: f.index, label: f.label }))
    }
  },

  update_loop_frame: async (p: Params) => {
    const frameIndex = num(p, 'frame_index') ?? 0
    const enabled = bool(p, 'enabled')
    const durationMultiplier = num(p, 'duration_multiplier')
    const offsetX = num(p, 'offset_x')
    const offsetY = num(p, 'offset_y')

    const animator = useLoopAnimator.getState()
    animator.updateFrame(frameIndex, {
      ...(enabled !== undefined ? { enabled } : {}),
      ...(durationMultiplier !== undefined ? { durationMultiplier } : {}),
      ...(offsetX !== undefined ? { offsetX } : {}),
      ...(offsetY !== undefined ? { offsetY } : {})
    })

    return {
      ok: true,
      frame: useLoopAnimator.getState().frames[frameIndex]
    }
  },

  set_loop_playback: async (p: Params) => {
    const fps = num(p, 'fps')
    const loopMode = str(p, 'loop_mode') as LoopMode | undefined
    const isPlaying = bool(p, 'is_playing')
    const currentFrame = num(p, 'current_frame')
    const onionSkin = bool(p, 'onion_skin')

    const animator = useLoopAnimator.getState()
    animator.setPlayback({
      ...(fps !== undefined ? { fps } : {}),
      ...(loopMode ? { loopMode } : {}),
      ...(isPlaying !== undefined ? { isPlaying } : {}),
      ...(currentFrame !== undefined ? { currentFrame } : {}),
      ...(onionSkin !== undefined ? { onionSkin } : {})
    })

    if (currentFrame !== undefined) {
      animator.selectFrame(currentFrame)
    }

    return {
      ok: true,
      playback: useLoopAnimator.getState().playback
    }
  },

  apply_loop_animation: async (p: Params) => {
    const name = str(p, 'name') || useLoopAnimator.getState().name
    const shotId = str(p, 'shot_id')
    const speed = num(p, 'speed') || 1
    const posArr = p.position as [number, number, number] | undefined

    const s = useLoopAnimator.getState()
    // Tạo canvas nguồn offscreen để trích xuất
    const sourceCanvas = document.createElement('canvas')
    sourceCanvas.width = s.imageNaturalSize.width || 1024
    sourceCanvas.height = s.imageNaturalSize.height || 1024
    const sctx = sourceCanvas.getContext('2d')

    if (sctx) {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = s.imageUrl
      if (img.complete && img.naturalWidth > 0) {
        sctx.drawImage(img, 0, 0)
      }
    }

    const layerId = await applyLoopAnimationToProject({
      name,
      sourceCanvas,
      frames: s.frames,
      playback: s.playback,
      shotId,
      speed,
      position: posArr
    })

    return {
      ok: Boolean(layerId),
      layer_id: layerId,
      frames_count: s.frames.filter((f) => f.enabled).length,
      name
    }
  }
}
