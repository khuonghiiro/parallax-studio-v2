import { describe, expect, it } from 'vitest'
import { evaluateLoopLayerRhythm, getAnimatedGifFrameIndex } from '../../project/gifHelper'
import { applyChromaKeyToImageData, buildGridFrames, computeLoopSheetGrid, parseHexRgb } from './loopFrameExtractor'
import {
  buildPackageGroupsMetadata,
  computeLoopGroupsSchedule
} from './loopGroupManager'
import { SAMPLE_LOOP_PRESETS } from './sampleLoops'
import { buildWorkshopLoopConfigFromTemplate } from '../layerAssembly/WorkshopLoopLogicPanel'
import { getBuiltinLoopTemplates } from './loopAnimatorStorage'
import { useLoopAnimator } from './loopAnimatorState'
import { findClusterRootLayer, isLayerClusterLocked, useEditor } from '../../store/editor'
import { createImageLayer } from '../../project/factory'
import { expandIntervalsWithTimeGroups } from '../../project/timelineIntervals'
import { moveTimelineLayers } from '../../project/timelineTiming'

describe('Loop Animator & Loop Rhythm Logic', () => {
  it('builds uniform grid frames accurately', () => {
    const frames = buildGridFrames(1024, 1024, {
      cols: 4,
      rows: 4,
      marginX: 0,
      marginY: 0,
      paddingX: 0,
      paddingY: 0
    })
    expect(frames).toHaveLength(16)
    expect(frames[0]).toMatchObject({ x: 0, y: 0, width: 256, height: 256, enabled: true })
    expect(frames[15]).toMatchObject({ x: 768, y: 768, width: 256, height: 256, enabled: true })
  })

  it('parses hex colors and applies chroma key removal', () => {
    expect(parseHexRgb('#00ff00')).toEqual([0, 255, 0])
    const raw = new Uint8ClampedArray([
      0, 255, 0, 255, // pure green background -> should become transparent
      255, 60, 20, 255 // fire orange pixel -> should stay opaque
    ])
    const fakeImageData = { data: raw, width: 2, height: 1 } as unknown as ImageData
    applyChromaKeyToImageData(fakeImageData, {
      enabled: true,
      keyColor: '#00ff00',
      similarity: 0.3,
      smoothness: 0.1,
      spill: 0.4
    })
    expect(raw[3]).toBe(0)
    expect(raw[7]).toBe(255)
  })

  it('evaluates getAnimatedGifFrameIndex across loop, ping-pong, once, and random modes', () => {
    const fakeGif = {
      width: 256,
      height: 256,
      totalDuration: 1.0,
      frames: [
        { index: 0, bitmap: {} as ImageBitmap, duration: 0.25, startTime: 0 },
        { index: 1, bitmap: {} as ImageBitmap, duration: 0.25, startTime: 0.25 },
        { index: 2, bitmap: {} as ImageBitmap, duration: 0.25, startTime: 0.5 },
        { index: 3, bitmap: {} as ImageBitmap, duration: 0.25, startTime: 0.75 }
      ]
    }
    expect(getAnimatedGifFrameIndex(fakeGif, 0.1, { loopMode: 'loop', speed: 1 })).toBe(0)
    expect(getAnimatedGifFrameIndex(fakeGif, 0.6, { loopMode: 'loop', speed: 1 })).toBe(2)
    expect(getAnimatedGifFrameIndex(fakeGif, 2.5, { loopMode: 'once', speed: 1 })).toBe(3)
    const randIdx = getAnimatedGifFrameIndex(fakeGif, 0.5, { loopMode: 'random', speed: 1 })
    expect(randIdx).toBeGreaterThanOrEqual(0)
    expect(randIdx).toBeLessThan(4)
  })

  it('evaluates evaluateLoopLayerRhythm for flicker_opacity, pulse_scale, sync_both, and strobe_beat', () => {
    const noneEval = evaluateLoopLayerRhythm({ loopRhythmMode: 'none' }, 0.5)
    expect(noneEval).toEqual({ opacityMultiplier: 1, scaleMultiplier: 1 })

    const flickerEval = evaluateLoopLayerRhythm(
      {
        loopRhythmMode: 'flicker_opacity',
        loopRhythmRateHz: 3,
        loopRhythmIntensity: 0.5,
        loopMinOpacity: 0.4
      },
      0.35
    )
    expect(flickerEval.opacityMultiplier).toBeGreaterThanOrEqual(0.4)
    expect(flickerEval.opacityMultiplier).toBeLessThanOrEqual(1)
    expect(flickerEval.scaleMultiplier).toBe(1)

    const pulseEval = evaluateLoopLayerRhythm(
      {
        loopRhythmMode: 'pulse_scale',
        loopRhythmRateHz: 2,
        loopRhythmIntensity: 0.8,
        loopScaleBeatPct: 20
      },
      0.25
    )
    expect(pulseEval.opacityMultiplier).toBe(1)
    expect(pulseEval.scaleMultiplier).toBeGreaterThanOrEqual(0.8)
    expect(pulseEval.scaleMultiplier).toBeLessThanOrEqual(1.25)

    const strobeEval = evaluateLoopLayerRhythm(
      {
        loopRhythmMode: 'strobe_beat',
        loopRhythmRateHz: 4,
        loopRhythmIntensity: 0.9,
        loopMinOpacity: 0.3,
        loopScaleBeatPct: 15
      },
      0.05
    )
    expect(strobeEval.opacityMultiplier).toBeGreaterThanOrEqual(0.3)
    expect(strobeEval.scaleMultiplier).toBeGreaterThanOrEqual(1)
  })

  it('creates valid 2.5D Workshop loop config from builtin templates', () => {
    const builtins = getBuiltinLoopTemplates()
    expect(builtins.length).toBeGreaterThanOrEqual(4)
    expect(SAMPLE_LOOP_PRESETS.length).toBeGreaterThanOrEqual(4)
    const cfg = buildWorkshopLoopConfigFromTemplate(builtins[0])
    expect(cfg.enabled).toBe(true)
    expect(cfg.frames?.length).toBe(builtins[0].frameCount)
    expect(cfg.fps).toBe(builtins[0].fps)
    expect(cfg.rhythmMode).toBeDefined()
  })

  it('computes 3-row grid layout and tracks focused frame for thumbnail on save', () => {
    expect(computeLoopSheetGrid(16)).toEqual({ cols: 6, rows: 3 })
    expect(computeLoopSheetGrid(12)).toEqual({ cols: 4, rows: 3 })
    expect(computeLoopSheetGrid(2)).toEqual({ cols: 2, rows: 1 })

    const st = useLoopAnimator.getState()
    st.clearFocusedFrame()
    expect(useLoopAnimator.getState().focusedFrameIndex).toBeNull()
    st.selectFrame(4)
    expect(useLoopAnimator.getState().selectedFrameIndex).toBe(4)
    expect(useLoopAnimator.getState().focusedFrameIndex).toBe(4)
    st.clearFocusedFrame()
    expect(useLoopAnimator.getState().focusedFrameIndex).toBeNull()
  })

  it('distinguishes cluster vs child layer selection scope for locked clusters', () => {
    const editor = useEditor.getState()
    const comp = editor.project.comp
    const shotId = editor.project.shots[0]?.id ?? null
    const rootLayer = createImageLayer(
      { id: 'asset-root', name: '1. Nền đất', kind: 'image', mime: 'image/png', width: 512, height: 512 },
      comp
    )
    rootLayer.shotId = shotId
    rootLayer.composite = {
      instanceId: 'comp-tree-1',
      compositeId: 'tpl-tree',
      compositeName: 'Cây Đại Thụ',
      isRoot: true,
      lockedGroup: true
    }
    const childLayer = createImageLayer(
      { id: 'asset-leaf', name: '2. Tán lá', kind: 'image', mime: 'image/png', width: 512, height: 512 },
      comp
    )
    childLayer.shotId = shotId
    childLayer.composite = {
      instanceId: 'comp-tree-1',
      compositeId: 'tpl-tree',
      compositeName: 'Cây Đại Thụ',
      isRoot: false,
      lockedGroup: true
    }
    editor.update((d) => {
      d.layers.unshift(rootLayer, childLayer)
    })

    expect(isLayerClusterLocked(rootLayer)).toBe(true)
    expect(findClusterRootLayer(useEditor.getState().project, childLayer)?.id).toBe(rootLayer.id)

    useEditor.getState().selectLayer(rootLayer.id)
    expect(useEditor.getState().layerSelectionScope).toBe('cluster')

    useEditor.getState().selectLayer(childLayer.id, 'layer')
    expect(useEditor.getState().layerSelectionScope).toBe('layer')
  })

  it('supports non-overwriting multi-group upload, reordering, per-group config, frame-triggered combo schedule, and animation.json group tagging', () => {
    const store = useLoopAnimator.getState()
    store.startBlank()
    expect(useLoopAnimator.getState().groups).toHaveLength(0)

    // 1. Tải ảnh thứ nhất -> Nhóm 1 (Sét đánh, 4 frame @ 10 FPS = 0.4s)
    useLoopAnimator.getState().appendImageAsGroup('data:image/png;base64,LIGHTNING_1', 'set_danh.png')
    useLoopAnimator.getState().setGridConfig({ cols: 2, rows: 2 })
    useLoopAnimator.getState().setChromaKey({ enabled: true, keyColor: '#00ff00', similarity: 0.35 })
    useLoopAnimator.getState().setFps(10)
    useLoopAnimator.getState().setLoopMode('once')

    expect(useLoopAnimator.getState().groups).toHaveLength(1)
    expect(useLoopAnimator.getState().activeGroupIndex).toBe(0)

    // 2. Tải ảnh thứ hai -> KHÔNG GHI ĐÈ Nhóm 1, tự động thêm nối tiếp thành Nhóm 2 (Vụ nổ / Vòng xoáy)
    useLoopAnimator.getState().appendImageAsGroup('data:image/png;base64,EXPLOSION_2', 'vu_no.png')
    expect(useLoopAnimator.getState().groups).toHaveLength(2)
    expect(useLoopAnimator.getState().activeGroupIndex).toBe(1)
    expect(useLoopAnimator.getState().comboPreviewMode).toBe(true)

    // Cấu hình riêng cho Nhóm 2: lưới 3x1 (3 frame), FPS 15, kích hoạt tại Frame #3 của Nhóm 1 (khi sét chạm đất), chờ 0.1s, giữ 3.5s, lệch vị trí X+40 Y+80
    useLoopAnimator.getState().setGridConfig({ cols: 3, rows: 1 })
    useLoopAnimator.getState().setFps(15)
    useLoopAnimator.getState().setLoopMode('loop')
    useLoopAnimator.getState().updateActiveGroupMeta({
      name: 'Nhóm 2: Vụ nổ & Xoáy',
      triggerMode: 'on_frame',
      triggerFrameIndex: 3,
      delaySec: 0.1,
      holdDurationSec: 3.5,
      offsetX: 40,
      offsetY: 80,
      scale: 1.25
    })

    // 3. Chuyển về Nhóm 1 kiểm tra cấu hình độc lập của Nhóm 1 vẫn còn nguyên vẹn
    useLoopAnimator.getState().selectGroup(0)
    expect(useLoopAnimator.getState().sourceImageUrl).toBe('data:image/png;base64,LIGHTNING_1')
    expect(useLoopAnimator.getState().gridConfig.cols).toBe(2)
    expect(useLoopAnimator.getState().gridConfig.rows).toBe(2)
    expect(useLoopAnimator.getState().chromaKey.enabled).toBe(true)
    expect(useLoopAnimator.getState().playback.fps).toBe(10)

    // 4. Kiểm tra lịch trình chạy kết hợp frame (computeLoopGroupsSchedule)
    const synced = useLoopAnimator.getState().getSyncedGroups()
    expect(synced).toHaveLength(2)
    const schedule = computeLoopGroupsSchedule(synced)
    expect(schedule.items).toHaveLength(2)
    // Nhóm 1: 4 frame @ 10 FPS -> mỗi frame 0.1s -> Frame #3 (index 2) bắt đầu tại 0.2s
    expect(schedule.items[0].startTime).toBe(0)
    expect(schedule.items[0].cycleDuration).toBeCloseTo(0.4, 2)
    // Nhóm 2: triggerMode = 'on_frame' tại Frame #3 (0.2s) + delaySec (0.1s) = bắt đầu tại 0.3s, giữ 3.5s -> kết thúc tại 3.8s
    expect(schedule.items[1].startTime).toBeCloseTo(0.3, 2)
    expect(schedule.items[1].activeDuration).toBeCloseTo(3.5, 2)
    expect(schedule.items[1].endTime).toBeCloseTo(3.8, 2)

    // 5. Kiểm tra metadata đóng gói animation.json xác nhận từng frame thuộc nhóm nào
    const { packageGroups, flatFramesWithGroupMeta } = buildPackageGroupsMetadata(synced)
    expect(packageGroups).toHaveLength(2)
    expect(packageGroups[0].frameIndices).toEqual([0, 1, 2, 3])
    expect(packageGroups[1].frameIndices).toEqual([4, 5, 6])
    expect(packageGroups[1].triggerMode).toBe('on_frame')
    expect(packageGroups[1].triggerFrameIndex).toBe(3)
    expect(packageGroups[1].delaySec).toBe(0.1)
    expect(packageGroups[1].holdDurationSec).toBe(3.5)
    expect(packageGroups[1].offsetX).toBe(40)
    expect(packageGroups[1].offsetY).toBe(80)
    expect(flatFramesWithGroupMeta).toHaveLength(7)
    expect(flatFramesWithGroupMeta[0].groupIndex).toBe(0)
    expect(flatFramesWithGroupMeta[4].groupIndex).toBe(1)
    expect(flatFramesWithGroupMeta[4].localFrameIndex).toBe(0)
    expect(flatFramesWithGroupMeta[4].group.name).toBe('Nhóm 2: Vụ nổ & Xoáy')

    // 6. Đổi thứ tự nhóm (reorderGroup) trên slider
    useLoopAnimator.getState().reorderGroup(1, 0)
    expect(useLoopAnimator.getState().groups[0].name).toBe('Nhóm 2: Vụ nổ & Xoáy')
  })

  it('synchronizes chroma key across checked groups, skips unchecked groups, and locks multi-group loop layers in scene', () => {
    const store = useLoopAnimator.getState()
    store.startBlank()
    store.appendImageAsGroup('data:image/png;base64,G1', 'g1.png')
    store.appendImageAsGroup('data:image/png;base64,G2', 'g2.png')
    store.appendImageAsGroup('data:image/png;base64,G3', 'g3.png')

    expect(useLoopAnimator.getState().groups).toHaveLength(3)
    // Mặc định cả 3 nhóm đều được tích chọn đồng bộ nền (syncChromaKey !== false)
    expect(useLoopAnimator.getState().groups.every((g) => g.syncChromaKey !== false)).toBe(true)

    // Bỏ tích chọn Nhóm #2 (index 1) vì có nền khác biệt
    useLoopAnimator.getState().toggleGroupSyncChroma(1)
    expect(useLoopAnimator.getState().groups[1].syncChromaKey).toBe(false)

    // Đứng ở Nhóm #1 (index 0), chỉnh thông số Tách nền -> Nhóm #1 và Nhóm #3 ăn theo, Nhóm #2 giữ nguyên độc lập
    useLoopAnimator.getState().selectGroup(0)
    useLoopAnimator.getState().setChromaKey({
      enabled: true,
      keyColor: '#000000',
      similarity: 0.44,
      shadowMode: 'include'
    })

    const syncedGroups = useLoopAnimator.getState().getSyncedGroups()
    expect(syncedGroups[0].chromaKey.similarity).toBeCloseTo(0.44, 2)
    expect(syncedGroups[0].chromaKey.shadowMode).toBe('include')
    expect(syncedGroups[2].chromaKey.similarity).toBeCloseTo(0.44, 2)
    expect(syncedGroups[2].chromaKey.shadowMode).toBe('include')
    expect(syncedGroups[1].chromaKey.similarity).not.toBeCloseTo(0.44, 2)

    // Cập nhật vị trí chạy của Nhóm #2 trực tiếp từ cột so sánh (updateGroupByIndex)
    useLoopAnimator.getState().updateGroupByIndex(1, {
      offsetX: -36,
      offsetY: 64,
      triggerMode: 'on_frame',
      triggerFrameIndex: 4
    })
    expect(useLoopAnimator.getState().groups[1].offsetX).toBe(-36)
    expect(useLoopAnimator.getState().groups[1].offsetY).toBe(64)
    expect(useLoopAnimator.getState().groups[1].triggerMode).toBe('on_frame')
    expect(useLoopAnimator.getState().groups[1].triggerFrameIndex).toBe(4)

    // Kiểm tra khoá cụm tổ hợp Loop trên cảnh & Timeline: di chuyển 1 layer trong cụm khoá sẽ dịch chuyển đồng bộ cả cụm
    const p = structuredClone(useEditor.getState().project)
    const comboId = 'loop_combo_test_lock'
    const l1 = createImageLayer({ id: 'a1', name: 'G1', kind: 'image', mime: 'image/png', width: 256, height: 256 }, p.comp, 0)
    const l2 = createImageLayer({ id: 'a2', name: 'G2', kind: 'image', mime: 'image/png', width: 256, height: 256 }, p.comp, 1)
    l1.inPoint = 0
    l1.outPoint = 1.2
    l2.inPoint = 0.5
    l2.outPoint = 2.5
    l1.composite = {
      instanceId: comboId,
      compositeId: comboId,
      compositeName: 'Sét & Nổ',
      isRoot: true,
      lockedGroup: true
    }
    l2.composite = {
      instanceId: comboId,
      compositeId: comboId,
      compositeName: 'Sét & Nổ',
      isRoot: false,
      lockedGroup: true
    }
    p.layers.push(l1, l2)

    expect(isLayerClusterLocked(l2)).toBe(true)
    expect(findClusterRootLayer(p, l2)?.id).toBe(l1.id)

    const expanded = expandIntervalsWithTimeGroups(p, [{ kind: 'layer', layerId: l1.id }])
    expect(expanded.map((x) => x.layerId)).toEqual(expect.arrayContaining([l1.id, l2.id]))

    moveTimelineLayers(p, [l1.id], 1.0, 'shift')
    expect(l1.inPoint).toBeCloseTo(1.0, 2)
    expect(l1.outPoint).toBeCloseTo(2.2, 2)
    expect(l2.inPoint).toBeCloseTo(1.5, 2)
    expect(l2.outPoint).toBeCloseTo(3.5, 2)
  })

  it('strictly isolates overwrite actions (Tải ảnh) from sequential append actions (Ảnh nối tiếp), while keeping Thay ảnh and Ghép lẻ scoped to active group', () => {
    const store = useLoopAnimator.getState()
    store.startBlank()

    // 1. Nạp ảnh đầu tiên bằng Tải ảnh (loadCustomImage) -> tạo 1 nhóm
    store.loadCustomImage('data:image/png;base64,IMG_INITIAL', 'Init.png')
    expect(useLoopAnimator.getState().groups).toHaveLength(1)
    expect(useLoopAnimator.getState().groups[0].name).toContain('Init')

    // 2. Nhấn "Ảnh nối tiếp" (appendImageAsGroup) -> tăng số nhóm lên 2 rồi 3
    store.appendImageAsGroup('data:image/png;base64,IMG_SEQ_2', 'Seq2.png')
    store.appendImageAsGroup('data:image/png;base64,IMG_SEQ_3', 'Seq3.png')
    expect(useLoopAnimator.getState().groups).toHaveLength(3)
    expect(useLoopAnimator.getState().groups[1].name).toContain('Seq2')
    expect(useLoopAnimator.getState().groups[2].name).toContain('Seq3')

    // 3. Đang ở Nhóm #2 (index 1), dùng "Thay ảnh" (replaceActiveGroupImage)
    // -> chỉ thay đổi ảnh nguồn của Nhóm #2, Nhóm #1 và Nhóm #3 vẫn giữ nguyên
    store.selectGroup(1)
    store.replaceActiveGroupImage('data:image/png;base64,IMG_REPLACED_2', 'Replaced2.png')
    const groupsAfterReplace = useLoopAnimator.getState().getSyncedGroups()
    expect(groupsAfterReplace).toHaveLength(3)
    expect(groupsAfterReplace[0].sourceImageUrl).toBe('data:image/png;base64,IMG_INITIAL')
    expect(groupsAfterReplace[1].sourceImageUrl).toBe('data:image/png;base64,IMG_REPLACED_2')
    expect(groupsAfterReplace[1].name).toContain('Replaced2')
    expect(groupsAfterReplace[2].sourceImageUrl).toBe('data:image/png;base64,IMG_SEQ_3')

    // 4. Dùng "Ghép lẻ" (loadCustomMultiFrames với resetGroups = false)
    // -> chỉ cập nhật frame cho Nhóm #2, toàn bộ 3 nhóm vẫn được bảo toàn
    store.loadCustomMultiFrames({
      dataUrl: 'data:image/png;base64,IMG_STITCHED_2',
      frames: [
        { id: 'f1', index: 0, x: 0, y: 0, width: 64, height: 64, offsetX: 0, offsetY: 0, enabled: true, durationRatio: 1 },
        { id: 'f2', index: 1, x: 64, y: 0, width: 64, height: 64, offsetX: 0, offsetY: 0, enabled: true, durationRatio: 1 }
      ],
      sourceWidth: 128,
      sourceHeight: 64,
      layerName: 'StitchedFrames',
      resetGroups: false
    })
    const groupsAfterStitch = useLoopAnimator.getState().getSyncedGroups()
    expect(groupsAfterStitch).toHaveLength(3)
    expect(groupsAfterStitch[1].sourceImageUrl).toBe('data:image/png;base64,IMG_STITCHED_2')
    expect(groupsAfterStitch[1].frames).toHaveLength(2)
    expect(groupsAfterStitch[0].sourceImageUrl).toBe('data:image/png;base64,IMG_INITIAL')
    expect(groupsAfterStitch[2].sourceImageUrl).toBe('data:image/png;base64,IMG_SEQ_3')

    // 5. Bấm nút "Tải ảnh" (loadCustomImage) -> GHI ĐÈ: xoá sạch chuỗi 3 nhóm cũ, chỉ còn 1 nhóm duy nhất với ảnh mới
    store.loadCustomImage('data:image/png;base64,IMG_OVERWRITE', 'NewSolo.png')
    const groupsAfterOverwrite = useLoopAnimator.getState().getSyncedGroups()
    expect(groupsAfterOverwrite).toHaveLength(1)
    expect(groupsAfterOverwrite[0].sourceImageUrl).toBe('data:image/png;base64,IMG_OVERWRITE')
    expect(groupsAfterOverwrite[0].name).toContain('NewSolo')
    expect(useLoopAnimator.getState().comboPreviewMode).toBe(false)
    expect(useLoopAnimator.getState().activeGroupIndex).toBe(0)

    // 6. Tải nhiều ảnh bằng nút "Tải ảnh" (loadCustomMultiFrames với resetGroups = true) -> GHI ĐÈ toàn bộ nhóm cũ
    // Trước hết thêm 1 nhóm nối tiếp để có 2 nhóm
    store.appendImageAsGroup('data:image/png;base64,IMG_EXTRA', 'Extra.png')
    expect(useLoopAnimator.getState().groups).toHaveLength(2)

    // Ghi đè bằng loadCustomMultiFrames (resetGroups = true)
    store.loadCustomMultiFrames({
      dataUrl: 'data:image/png;base64,IMG_MULTI_OVERWRITE',
      frames: [
        { id: 'm1', index: 0, x: 0, y: 0, width: 100, height: 100, offsetX: 0, offsetY: 0, enabled: true, durationRatio: 1 }
      ],
      sourceWidth: 100,
      sourceHeight: 100,
      layerName: 'MultiOverwriteSolo',
      resetGroups: true
    })
    const groupsAfterMultiOverwrite = useLoopAnimator.getState().getSyncedGroups()
    expect(groupsAfterMultiOverwrite).toHaveLength(1)
    expect(groupsAfterMultiOverwrite[0].sourceImageUrl).toBe('data:image/png;base64,IMG_MULTI_OVERWRITE')
    expect(groupsAfterMultiOverwrite[0].name).toContain('MultiOverwriteSolo')
    expect(useLoopAnimator.getState().activeGroupIndex).toBe(0)
  })
})
