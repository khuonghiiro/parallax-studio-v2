import { useView } from '../../store/view'
import { exportLoopPresetDirectly } from '../../ui/loopAnimator/loopAnimationExporter'
import { getAllLoopTemplates } from '../../ui/loopAnimator/loopAnimatorStorage'
import { useLoopAnimator } from '../../ui/loopAnimator/loopAnimatorState'
import type { LoopAnimationMode, LoopRhythmMode, SlicerMode } from '../../ui/loopAnimator/types'
import { bool, num, str } from '../params'
import type { Handler, Params } from '../types'
import { loopLibraryCommands } from './loopLibraryCommands'

export const loopAnimatorCommands: Record<string, Handler> = {
  ...loopLibraryCommands,

  open_loop_animator: async (p: Params) => {
    const presetId = str(p, 'preset_id')
    const blank = bool(p, 'blank') ?? false
    const imageUrl = str(p, 'image_url')
    const rows = num(p, 'rows')
    const cols = num(p, 'cols')
    const chroma = bool(p, 'chroma')
    const keyColor = str(p, 'key_color')

    const animator = useLoopAnimator.getState()

    if (blank) animator.startBlank()
    if (presetId) {
      animator.open(presetId)
    } else if (imageUrl) {
      animator.open()
      animator.loadCustomImage(imageUrl)
    } else {
      animator.open()
    }

    if (rows !== undefined || cols !== undefined) {
      animator.setGridConfig({
        ...(rows !== undefined ? { rows } : {}),
        ...(cols !== undefined ? { cols } : {})
      })
    }

    if (chroma !== undefined || keyColor) {
      animator.setChromaKey({
        ...(chroma !== undefined ? { enabled: chroma } : {}),
        ...(keyColor ? { keyColor } : {})
      })
    }

    useView.getState().openDialog('loop_animator')

    const s = useLoopAnimator.getState()
    return {
      ok: true,
      is_open: true,
      name: s.layerName,
      image_url: s.sourceImageUrl,
      frames_count: s.frames.length,
      fps: s.playback.fps,
      speed: s.playback.speed,
      loop_mode: s.playback.loopMode,
      rhythm: s.playback.rhythm
    }
  },

  close_loop_animator: async () => {
    useLoopAnimator.getState().close()
    useView.getState().openDialog(null)
    return { ok: true, is_open: false }
  },

  get_loop_animator_state: async () => {
    const s = useLoopAnimator.getState()
    const activeDialog = useView.getState().dialog
    return {
      ok: true,
      is_open: activeDialog === 'loop_animator',
      name: s.layerName,
      category: s.category,
      image_url: s.sourceImageUrl,
      image_dimensions: { width: s.sourceWidth, height: s.sourceHeight },
      slicer_mode: s.slicerMode,
      grid_config: s.gridConfig,
      contour_config: s.contourConfig,
      chroma_config: s.chromaKey,
      frames_count: s.frames.length,
      enabled_frames_count: s.frames.filter((f) => f.enabled).length,
      selected_frame_index: s.selectedFrameIndex,
      playing_frame_index: s.playingFrameIndex,
      playback: s.playback,
      templates_count: getAllLoopTemplates().length,
      frames: s.frames.map((f) => ({
        id: f.id,
        index: f.index,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        enabled: f.enabled,
        duration_ratio: f.durationRatio,
        offset_x: f.offsetX,
        offset_y: f.offsetY
      }))
    }
  },

  configure_loop_chroma: async (p: Params) => {
    const enabled = bool(p, 'enabled')
    const keyColor = str(p, 'key_color') ?? str(p, 'custom_hex')
    const similarity = num(p, 'similarity') ?? num(p, 'tolerance')
    const smoothness = num(p, 'smoothness')
    const spill = num(p, 'spill') ?? num(p, 'despill')

    const animator = useLoopAnimator.getState()
    animator.setChromaKey({
      ...(enabled !== undefined ? { enabled } : {}),
      ...(keyColor ? { keyColor } : {}),
      ...(similarity !== undefined ? { similarity } : {}),
      ...(smoothness !== undefined ? { smoothness } : {}),
      ...(spill !== undefined ? { spill } : {})
    })

    return {
      ok: true,
      chroma_config: useLoopAnimator.getState().chromaKey
    }
  },

  split_loop_frames: async (p: Params) => {
    const mode = str(p, 'mode') as SlicerMode | undefined
    const rows = num(p, 'rows')
    const cols = num(p, 'cols')
    const padding = num(p, 'padding')

    const animator = useLoopAnimator.getState()
    if (mode === 'grid' || mode === 'contour' || mode === 'manual') {
      animator.setSlicerMode(mode)
    }

    if (rows !== undefined || cols !== undefined || padding !== undefined) {
      animator.setGridConfig({
        ...(rows !== undefined ? { rows } : {}),
        ...(cols !== undefined ? { cols } : {}),
        ...(padding !== undefined ? { paddingX: padding, paddingY: padding } : {})
      })
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
      case 'move':
        if (fromIndex !== undefined && toIndex !== undefined) {
          animator.reorderFrame(fromIndex, toIndex)
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
      frames: useLoopAnimator.getState().frames.map((f) => ({ id: f.id, index: f.index }))
    }
  },

  update_loop_frame: async (p: Params) => {
    const frameIndex = num(p, 'frame_index') ?? 0
    const enabled = bool(p, 'enabled')
    const durationRatio = num(p, 'duration_ratio') ?? num(p, 'duration_multiplier')
    const offsetX = num(p, 'offset_x')
    const offsetY = num(p, 'offset_y')

    const animator = useLoopAnimator.getState()
    animator.updateFrame(frameIndex, {
      ...(enabled !== undefined ? { enabled } : {}),
      ...(durationRatio !== undefined ? { durationRatio } : {}),
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
    const speed = num(p, 'speed')
    const loopMode = str(p, 'loop_mode') as LoopAnimationMode | undefined
    const isPlaying = bool(p, 'is_playing')
    const currentFrame = num(p, 'current_frame')
    const onionSkin = bool(p, 'onion_skin')
    const rhythmMode = str(p, 'rhythm_mode') as LoopRhythmMode | undefined
    const rhythmRateHz = num(p, 'rhythm_rate_hz')
    const rhythmIntensity = num(p, 'rhythm_intensity')

    const animator = useLoopAnimator.getState()
    animator.setPlayback({
      ...(fps !== undefined ? { fps } : {}),
      ...(speed !== undefined ? { speed } : {}),
      ...(loopMode ? { loopMode } : {}),
      ...(isPlaying !== undefined ? { isPlaying } : {}),
      ...(onionSkin !== undefined ? { onionSkin } : {})
    })
    if (rhythmMode || rhythmRateHz !== undefined || rhythmIntensity !== undefined) {
      animator.setRhythm({
        ...(rhythmMode ? { rhythmMode } : {}),
        ...(rhythmRateHz !== undefined ? { rhythmRateHz } : {}),
        ...(rhythmIntensity !== undefined ? { rhythmIntensity } : {})
      })
    }

    if (currentFrame !== undefined) {
      animator.selectFrame(currentFrame)
    }

    return {
      ok: true,
      playback: useLoopAnimator.getState().playback
    }
  },

  apply_loop_animation: async (p: Params) => {
    const s = useLoopAnimator.getState()
    const presetId = str(p, 'preset_id') || s.activePresetId || 'loop_preset_campfire'
    const name = str(p, 'name') || s.layerName
    const shotId = str(p, 'shot_id')
    const speed = num(p, 'speed') ?? s.playback.speed
    const fps = num(p, 'fps') ?? s.playback.fps
    const loopMode = (str(p, 'loop_mode') as LoopAnimationMode | undefined) ?? s.playback.loopMode

    const res = await exportLoopPresetDirectly(presetId, {
      layerName: name,
      fps,
      speed,
      loopMode,
      shotId
    })

    return {
      ok: Boolean(res.layerId),
      layer_id: res.layerId,
      asset_id: res.assetId,
      frames_count: res.frameCount,
      name
    }
  }
}
