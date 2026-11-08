import { useEditor } from '../../store/editor'
import { useView } from '../../store/view'
import { usePerformance } from '../../store/performance'
import { useAssetManifestStore } from '../../store/assetManifest'
import { getProjectAudioTracks } from '../../project/audioTracks'
import { findActiveDialog } from '../../mcp/uiRegions'
import type { AiWorkshopContext } from './aiUiInspectorWorkshopContext'

function hasOpenEl(selector: string, matchedElements: Element[]): boolean {
  for (const el of matchedElements) {
    if (el.matches?.(selector) || el.closest?.(selector)) return true
  }
  if (typeof document !== 'undefined' && typeof document.querySelector === 'function') {
    try {
      const found = document.querySelector(selector)
      if (found) {
        const r = found.getBoundingClientRect()
        if (r.width > 0 && r.height > 0) return true
      }
    } catch {
      /* ignore */
    }
  }
  return false
}

/**
 * Nhận diện các hộp thoại con (Nested Modal) đang mở bên trong Xưởng Lắp Ráp 2.5D.
 */
export function detectNestedLayerAssemblySubModal(matchedElements: Element[]): {
  subDialogKey: string
  title: string
  relatedFiles: string[]
  summaryLine: string
} | null {
  if (hasOpenEl('.lw-mixamo-motion-modal, [data-mcp-region="layer_assembly_mixamo_studio"]', matchedElements)) {
    return {
      subDialogKey: 'layer_assembly_mixamo_studio',
      title: 'Studio Dựng Dáng & Chuyển Động Mixamo 2.5D',
      relatedFiles: [
        'src/renderer/src/ui/layerAssembly/WorkshopMixamoRigCard.tsx',
        'src/renderer/src/ui/layerAssembly/MixamoLandmarkPlacer.tsx',
        'src/renderer/src/ui/layerAssembly/MixamoStudioSidebar.tsx',
        'src/renderer/src/ui/layerAssembly/workshopMixamoAutoRig.ts'
      ],
      summaryLine: 'Đang mở hộp thoại lồng: Studio Dựng Dáng & Chuyển Động Mixamo 2.5D (.lw-mixamo-motion-modal)'
    }
  }
  if (hasOpenEl('.lw-clip-json-modal, [data-mcp-region="layer_assembly_clip_json"]', matchedElements)) {
    return {
      subDialogKey: 'layer_assembly_clip_json',
      title: 'Hộp Thoại Trao Đổi JSON Hoạt Ảnh Clip & Gió 2.5D',
      relatedFiles: [
        'src/renderer/src/ui/layerAssembly/WorkshopClipJsonModal.tsx',
        'src/renderer/src/ui/layerAssembly/workshopClipJson.ts',
        'src/renderer/src/ui/layerAssembly/WorkshopClipBar.tsx'
      ],
      summaryLine: 'Đang mở hộp thoại lồng: Trao đổi JSON Hoạt ảnh Clip & Gió (.lw-clip-json-modal)'
    }
  }
  if (hasOpenEl('.lw-swap-modal, .composite-swap-modal, [data-mcp-region="layer_assembly_swap"]', matchedElements)) {
    return {
      subDialogKey: 'layer_assembly_swap',
      title: 'Hộp Thoại Thay Thế Bộ Phận / Biến Thể 2.5D (Part Swap)',
      relatedFiles: [
        'src/renderer/src/ui/layerAssembly/PartSwapDialog.tsx',
        'src/renderer/src/ui/layerAssembly/WorkshopPartsPanel.tsx'
      ],
      summaryLine: 'Đang mở hộp thoại lồng: Thay thế Bộ phận 2.5D (.lw-swap-modal)'
    }
  }
  if (hasOpenEl('[data-mcp-region="layer_assembly_retarget"]', matchedElements)) {
    return {
      subDialogKey: 'layer_assembly_retarget',
      title: 'Hộp Thoại Sao Chép Chuyển Động Giữa Các Nhân Vật (Retarget)',
      relatedFiles: [
        'src/renderer/src/ui/layerAssembly/WorkshopRetargetDialog.tsx',
        'src/renderer/src/ui/layerAssembly/workshopRetarget.ts'
      ],
      summaryLine: 'Đang mở hộp thoại lồng: Retarget Chuyển động 2.5D'
    }
  }
  if (hasOpenEl('[data-mcp-region="layer_assembly_create"]', matchedElements)) {
    return {
      subDialogKey: 'layer_assembly_create',
      title: 'Hộp Thoại Tạo Mẫu Lắp Ráp 2.5D Mới',
      relatedFiles: ['src/renderer/src/ui/layerAssembly/CreateLayerAssemblyModal.tsx'],
      summaryLine: 'Đang mở hộp thoại lồng: Tạo Mẫu Lắp Ráp 2.5D Mới'
    }
  }
  if (hasOpenEl('.tpm-modal', matchedElements)) {
    return {
      subDialogKey: 'template_prompt',
      title: 'Hộp Thoại Lưu / Tạo Mẫu (Template Prompt)',
      relatedFiles: [
        'src/renderer/src/ui/layerAssembly/templates/TemplatePromptModal.tsx',
        'src/renderer/src/ui/layerAssembly/cutter/SaveTemplateDialog.tsx'
      ],
      summaryLine: 'Đang mở hộp thoại lồng: Lưu / Tạo Mẫu (.tpm-modal)'
    }
  }
  return null
}

/**
 * Thu thập ngữ cảnh chi tiết cho tất cả các Hộp thoại (Dialogs / Modals) khác trong ứng dụng
 * ngoài 3 xưởng chính (Photo Studio, Audio Studio, Manifest, Remote QR, MCP, Performance, Export, Camera Path/Sketch, Workflow Node...).
 */
export function extractOtherDialogOrWorkshopContext(
  matchedElements: Element[]
): AiWorkshopContext | null {
  const view = useView.getState()
  const editor = useEditor.getState()
  const project = editor.project

  // 1. Xưởng Tách Nền & Chỉnh Sửa Ảnh (Photo Studio)
  if (view.dialog === 'photo_editor' || hasOpenEl('.ps-modal-container, .ps-save-modal', matchedElements)) {
    const isSaveModal = hasOpenEl('.ps-save-modal', matchedElements)
    return {
      workshopType: 'photo_editor',
      workshopTitle: isSaveModal
        ? 'Hộp Thoại Lưu Ảnh Tách Nền (Photo Studio Save Modal)'
        : 'Xưởng Tách Nền & Chỉnh Sửa Ảnh (Photo Studio)',
      modelName: view.photoEditorInitialImage || 'Ảnh đang chỉnh sửa trong Photo Studio',
      modelId: 'photo_editor',
      scannedParts: [],
      scannedBones: [],
      relatedFiles: isSaveModal
        ? [
            'src/renderer/src/ui/photoStudio/PhotoStudioSaveModal.tsx',
            'src/renderer/src/ui/photoStudio/PhotoStudioDialog.tsx'
          ]
        : [
            'src/renderer/src/ui/photoStudio/PhotoStudioDialog.tsx',
            'src/renderer/src/ui/photoStudio/PhotoStudioToolbar.tsx',
            'src/renderer/src/ui/photoStudio/PhotoStudioLeftRail.tsx',
            'src/renderer/src/ui/photoStudio/PhotoStudioRightRail.tsx',
            'src/renderer/src/ui/photoStudio/PhotoStudioColorGradingRailGroup.tsx'
          ],
      extraSummaryLines: [
        isSaveModal
          ? 'Trạng thái: Đang mở hộp thoại xác nhận xuất/lưu ảnh PNG đã tách nền (.ps-save-modal)'
          : 'Cấu trúc UI: Thanh công cụ trên (.ps-toolbar), Cột công cụ trái (.ps-left-rail), Canvas giữa (.ps-viewport-wrap), Cột thông số phải (.ps-right-rail)'
      ]
    }
  }

  // 2. Phòng Thu Âm Thanh & Bàn Trộn Mixer (Audio Studio)
  if (view.dialog === 'audio' || hasOpenEl('.audio-studio-modal, .audio-studio-dialog', matchedElements)) {
    const tracks = getProjectAudioTracks(project)
    return {
      workshopType: 'audio_studio',
      workshopTitle: 'Phòng Thu Âm Thanh & Bàn Trộn Mixer (Audio Studio)',
      modelName: `${tracks.length} kênh âm thanh trong dự án`,
      modelId: `audio_${view.audioDialogMode || 'waveform'}`,
      primaryModeLabel: `Chế độ mở: ${view.audioDialogMode || 'waveform'}`,
      scannedParts: [],
      scannedBones: [],
      relatedFiles: [
        'src/renderer/src/ui/AudioStudioDialog.tsx',
        'src/renderer/src/ui/audioStudio/AudioStudioTrackList.tsx',
        'src/renderer/src/ui/audioStudio/AudioStudioWaveform.tsx',
        'src/renderer/src/project/audioTracks.ts'
      ],
      extraSummaryLines: [
        `Tổng số rãnh âm thanh (Audio Tracks): ${tracks.length} rãnh`,
        ...(tracks.slice(0, 3).map((t) => `Rãnh "${t.name}" (${t.id}): Volume ${Math.round((t.volume ?? 1) * 100)}%, Tone: ${t.tone || 'normal'}${t.muted ? ' [Đang tắt tiếng]' : ''}`))
      ]
    }
  }

  // 3. Hộp thoại Quản lý Manifest Tài nguyên & Khôi phục File (Asset Manifest Dialog)
  if (view.dialog === 'manifest' || hasOpenEl('.manifest-modal, [data-mcp-region="manifest_dialog"]', matchedElements)) {
    const mfState = useAssetManifestStore.getState()
    return {
      workshopType: 'general',
      workshopTitle: 'Quản Lý Manifest Tài Nguyên & Khôi Phục File (Asset Manifest)',
      modelName: 'assets/manifest.json + assets/manifests/*.json',
      modelId: 'manifest_dialog',
      scannedParts: [],
      scannedBones: [],
      relatedFiles: [
        'src/renderer/src/ui/manifest/AssetManifestDialog.tsx',
        'src/renderer/src/ui/manifest/ManifestCategorySection.tsx',
        'src/renderer/src/ui/manifest/ManifestAssetSection.tsx',
        'src/renderer/src/store/assetManifest.ts',
        'src/main/manifestCoordinator.ts'
      ],
      extraSummaryLines: [
        `Tổng mục tài nguyên đang hoạt động: ${mfState.items?.length ?? 0} mục · Trong thùng rác tạm (_temp_deleted): ${mfState.deletedItems?.length ?? 0} mục`
      ]
    }
  }

  // 4. Hộp thoại Điều khiển qua Điện thoại & QR Code (Mobile Wi-Fi Remote)
  if (view.dialog === 'remote' || hasOpenEl('.remote-modal, [data-mcp-region="remote_dialog"]', matchedElements)) {
    return {
      workshopType: 'general',
      workshopTitle: 'Điều Khiển Qua Điện Thoại & QR Code (Mobile Wi-Fi Remote)',
      modelName: 'Mobile Remote 3D Touchpad & Studio Sync',
      modelId: 'remote_dialog',
      scannedParts: [],
      scannedBones: [],
      relatedFiles: [
        'src/renderer/src/ui/MobileRemoteDialog.tsx',
        'src/renderer/src/ui/remote/RemoteQrNetworkCard.tsx',
        'src/renderer/src/ui/remote/RemoteConnectedDevicesCard.tsx',
        'src/renderer/src/ui/remote/RemoteLiveTouchpadPanel.tsx',
        'src/renderer/src/mcp/commands/remoteCommands.ts'
      ],
      extraSummaryLines: [
        'Cấu trúc UI: Thẻ QR & Mạng LAN trái (.remote-qr-card), Cột Thiết bị kết nối (.remote-devices-card) & Bàn di cảm ứng trực tiếp (.remote-touchpad-card)'
      ]
    }
  }

  // 5. Hộp thoại Cấu hình Kết nối AI (MCP Dialog)
  if (view.dialog === 'mcp' || hasOpenEl('.mcp-modal, [data-mcp-region="mcp_dialog"]', matchedElements)) {
    return {
      workshopType: 'general',
      workshopTitle: 'Cấu Hình Kết Nối AI (MCP Server & CLI)',
      modelName: 'TCP 127.0.0.1:9877 · pnpm pxs',
      modelId: 'mcp_dialog',
      scannedParts: [],
      scannedBones: [],
      relatedFiles: [
        'src/renderer/src/ui/McpDialog.tsx',
        'src/renderer/src/ui/mcp/McpAiGuideCard.tsx',
        'src/renderer/src/ui/mcp/McpIdeAndShellCard.tsx',
        'src/renderer/src/ui/mcp/aiGuide.ts'
      ],
      extraSummaryLines: [
        'Quản lý kết nối MCP Server (127.0.0.1:9877), cấu hình IDE và hướng dẫn lệnh điều khiển CLI (pnpm pxs)'
      ]
    }
  }

  // 6. Hộp thoại Hiệu năng & GPU (Performance Dialog)
  if (view.dialog === 'performance' || hasOpenEl('.perf-modal', matchedElements)) {
    const perf = usePerformance.getState()
    return {
      workshopType: 'general',
      workshopTitle: 'Cấu Hình Hiệu Năng, RAM & VRAM GPU',
      modelName: perf.hardware?.gpuName || perf.webgl?.renderer || 'GPU Hệ thống',
      modelId: 'perf_dialog',
      scannedParts: [],
      scannedBones: [],
      relatedFiles: [
        'src/renderer/src/ui/PerformanceDialog.tsx',
        'src/renderer/src/store/performance.ts'
      ],
      extraSummaryLines: [
        `Ngân sách bộ nhớ đệm (VRAM Budget): ${perf.budgetMB} MB · Độ phân giải Texture tối đa: ${perf.maxTextureSize}px · Lọc Anisotropy: ${perf.maxAnisotropy}x`
      ]
    }
  }

  // 7. Hộp thoại Xuất Video MP4 (Export Dialog)
  if (view.dialog === 'export' || hasOpenEl('.export-modal', matchedElements)) {
    return {
      workshopType: 'general',
      workshopTitle: 'Hộp Thoại Xuất Video MP4 (Render Queue)',
      modelName: `${project.comp.name} (${project.comp.width}×${project.comp.height} @ ${project.comp.fps}fps)`,
      modelId: 'export_dialog',
      scannedParts: [],
      scannedBones: [],
      relatedFiles: [
        'src/renderer/src/ui/ExportDialog.tsx',
        'src/renderer/src/export/runExport.ts',
        'src/main/ffmpeg.ts'
      ],
      extraSummaryLines: [
        `Thông số gốc Composition: ${project.comp.width}×${project.comp.height}px · ${project.comp.fps} FPS · Thời lượng: ${project.comp.duration}s`
      ]
    }
  }

  // 8. Hộp thoại Lộ trình Camera 3D (Camera Path Dialog)
  if (view.dialog === 'path' || hasOpenEl('.camera-path-modal', matchedElements)) {
    return {
      workshopType: 'general',
      workshopTitle: 'Lộ Trình Camera 3D Qua Các Cảnh (Camera Path)',
      modelName: `${project.shots.length} phân cảnh`,
      modelId: 'camera_path',
      scannedParts: [],
      scannedBones: [],
      relatedFiles: [
        'src/renderer/src/ui/CameraPathDialog.tsx',
        'src/renderer/src/animation/cameraPath.ts'
      ],
      extraSummaryLines: [
        `Số phân cảnh trong dự án: ${project.shots.length} cảnh · FPS: ${project.comp.fps}`
      ]
    }
  }

  // 9. Hộp thoại Vẽ Đường Bay Camera (Camera Sketch Dialog)
  if (view.dialog === 'sketch' || hasOpenEl('.camera-sketch-modal', matchedElements)) {
    return {
      workshopType: 'general',
      workshopTitle: 'Vẽ Đường Bay Camera Tự Do (Camera Sketch)',
      modelName: `${project.shots.length} phân cảnh`,
      modelId: 'camera_sketch',
      scannedParts: [],
      scannedBones: [],
      relatedFiles: [
        'src/renderer/src/ui/CameraSketchDialog.tsx',
        'src/renderer/src/animation/cameraSketch.ts'
      ],
      extraSummaryLines: [
        `Thời lượng dự án: ${project.comp.duration}s · Số phân cảnh: ${project.shots.length}`
      ]
    }
  }

  // 10. Hộp thoại Cấu hình Node Workflow V2
  if (hasOpenEl('.wf-node-config-modal, .wf-node-dialog-window', matchedElements)) {
    return {
      workshopType: 'general',
      workshopTitle: 'Hộp Thoại Cấu Hình Node Workflow V2',
      modelName: 'Node Configuration Modal',
      modelId: 'workflow_node_config',
      scannedParts: [],
      scannedBones: [],
      relatedFiles: [
        'src/renderer/src/ui/workflow/WorkflowNodeConfigDialog.tsx',
        'src/renderer/src/ui/workflow/WorkflowNodeDraftDialog.tsx',
        'src/renderer/src/ui/workflow/WorkflowNodeDialogChrome.tsx'
      ]
    }
  }

  return null
}

/**
 * Phát hiện chính xác định danh của Hộp thoại / Modal đang nổi trên cùng lúc quét
 * (bao gồm cả các hộp thoại lồng không lưu trong `useView.getState().dialog`).
 */
export function resolveActiveDialogIdentifier(
  workshopType: string | null | undefined,
  matchedElements: Element[]
): string | null {
  const nestedLa = detectNestedLayerAssemblySubModal(matchedElements)
  if (nestedLa) return nestedLa.subDialogKey

  if (hasOpenEl('.ps-save-modal', matchedElements)) return 'photo_editor_save_modal'
  if (hasOpenEl('.loop-align-studio-modal', matchedElements)) return 'loop_animator_align_studio'
  if (hasOpenEl('.loop-del-dialog', matchedElements)) return 'loop_delete_confirm'
  if (hasOpenEl('.wf-node-config-modal, .wf-node-dialog-window', matchedElements)) return 'workflow_node_config'

  if (workshopType === 'layer_assembly_25d') return 'layer_assembly'

  const view = useView.getState()
  if (view.dialog) return view.dialog
  if (view.assemblyModalModel) return 'create_3d'

  if (typeof document !== 'undefined') {
    const activeDomDialog = findActiveDialog(document)
    if (activeDomDialog) {
      const regionAttr = activeDomDialog.getAttribute?.('data-mcp-region')
      if (regionAttr && regionAttr !== 'ai_inspector_preview') return regionAttr
    }
  }

  return null
}
