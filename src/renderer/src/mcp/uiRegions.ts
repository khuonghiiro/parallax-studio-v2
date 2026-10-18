/**
 * Bảng vùng UI (region) cho MCP `get_app_screenshot`.
 *
 * Quy ước BẮT BUỘC khi tạo / sửa UI (xem AGENTS.md §2.5):
 *  1. Phần tử gốc của dialog / panel / card / toolbar có class ngữ nghĩa + `data-mcp-region="<ten_vung>"`.
 *     Dialog lồng bên trong dialog khác (VD Studio Mixamo trong Xưởng Layer) gắn thêm `data-mcp-dialog`.
 *  2. Khai báo `<ten_vung>` trong `UI_REGION_SELECTORS` dưới đây.
 *  3. Khai báo cùng tên trong enum `region` của `mcp-server/catalog/tools-scene.mjs`, rồi chạy `pnpm mcp:schemas`.
 *  `uiRegions.test.ts` quét toàn bộ `*.tsx` và báo lỗi nếu thiếu bước 2 hoặc 3.
 */

/** Vùng đặc biệt: tự động chụp dialog/modal đang nằm TRÊN CÙNG (dialog lồng được ưu tiên). */
export const ACTIVE_REGION = 'active'

/** Các selector nhận diện dialog/modal nổi (không bao giờ đưa lớp phủ backdrop toàn màn hình vào đây). */
export const DIALOG_SELECTORS = [
  '[data-mcp-dialog]',
  '.tpm-modal',
  '.layer-workshop-dialog',
  '.lat-dialog',
  '.assembly-modal-content',
  '.audio-studio-modal',
  '.audio-studio-dialog',
  '.export-modal',
  '.perf-modal',
  '.mcp-modal',
  '.camera-path-modal',
  '.camera-sketch-modal',
  '.modal[role="dialog"]',
  '.modal',
  '[role="dialog"]',
  '[aria-modal="true"]'
]

const region = (name: string, ...classes: string[]): string[] => [`[data-mcp-region="${name}"]`, ...classes]

export const UI_REGION_SELECTORS: Record<string, string[]> = {
  // Vùng đặc biệt: dialog trên cùng (được xử lý riêng bởi findActiveDialog)
  active: DIALOG_SELECTORS,

  // Left Sidebar and sub-sections
  left_panel: ['aside.left', '.left', '.panel-left'],
  assets: ['.asset-panel-wrapper', '.asset-main-layout', 'aside.left'],
  asset_grid: [
    '.builtin-grid-wrap',
    '.builtin-asset-grid',
    '.project-asset-grid',
    '.music-list-scroll',
    '.model3d-grid-wrap',
    '.lw-template-grid'
  ],
  asset_bar: ['.asset-vertical-strip', '.builtin-asset-bar', '.music-category-bar', '.model3d-category-bar', '.lw-category-bar'],
  music: ['.music-panel-layout', '.music-panel-container', '.music-panel-main'],
  shots: ['.shots', '.shots-panel', 'aside.left .panel-body'],
  topview: ['.topview', '.topview-canvas-wrap', '.top-view', '#viewport-topview', '.topview-toolbar'],

  // Center Viewer and sub-sections
  viewer: ['.viewer-wrap', '.viewer', '#viewport-container'],
  viewer_canvas: ['#viewer-canvas', '.viewer canvas'],
  viewport: ['#viewer-canvas', '.viewer canvas'],
  camera_frame: ['#camera-frame', '.camera-frame'],
  viewer_hud: ['.viewer-hud'],
  viewer_tools: ['.viewer-tools'],
  animate_camera_stage: ['#animate-camera-stage', '.anim2d-stage', '.anim2d-pane-host'],
  animate_camera_toolbar: ['.anim2d-toolbar'],
  animate_camera_route: ['#camera-route-inspector', '.camera-route-inspector', '#tab-route'],
  animate_camera_inspector: ['#camera-route-inspector', '.camera-route-inspector .active-wp-section'],

  // Right Inspector and sub-sections
  inspector: ['aside.right', '.right', '.inspector'],
  inspector_tabs: ['aside.right .tabs'],
  inspector_body: ['aside.right .panel-body'],
  inspector_composite: region('inspector_composite', '.composite-section'),
  composite_swap: region('composite_swap', '.composite-swap-modal'),
  effect_stack: ['.layer-effects-section'],
  effect_editor: ['.effect-editor'],
  timeline_effects: ['.timeline-effect-row'],
  fx_presets: ['.tl-fx-popover'],
  motion: ['.motion-controls'],
  motion_preview: ['.motion-preview'],
  motion_parameters: ['.motion-parameters'],
  motion_timing: ['.motion-timing'],

  // Bottom Timeline and sub-sections
  timeline: ['section.panel.timeline', 'section.timeline', '.timeline'],
  timeline_toolbar: ['.timeline-toolbar', '.tl-toolbar'],
  timeline_ruler: ['.tl-header', '.tl-ruler-wrap'],
  timeline_tracks: ['.tl-scroll', '.tl-body', '.tl-rows-scroll'],

  // Top Toolbar & Responsive Workspace Dock
  toolbar: ['header.toolbar', '.toolbar'],
  studio_menu: ['#menu-studio', '.toolbar'],
  mcp_chip: ['#mcp-chip', '.mcp-chip'],
  responsive_dock: ['#responsive-dock', '.responsive-dock'],

  // Floating Modals & Workshops — `dialog` cũng tự chọn dialog trên cùng giống `active`
  dialog: DIALOG_SELECTORS,

  // 1. Xưởng 3D (Assembly 3D Workshop)
  assembly_3d: ['.assembly-modal-content'],
  assembly_sidebar: ['.assembly-asset-sidebar', '.assembly-modal-body > aside'],
  assembly_viewport: ['.assembly-viewport-panel', '.assembly-split-container'],
  assembly_inspector: ['.assembly-inspector-panel'],
  assembly_header: ['.assembly-modal-header'],
  assembly_footer: ['.assembly-modal-footer'],
  assembly_hud: ['.assembly-3d-hud-container'],

  // 2. Xưởng Layer 2.5D (Layer Assembly Workshop) — toàn bộ, từng cột và dialog lồng bên trong
  layer_assembly: ['.tpm-modal', '.layer-workshop-dialog', '.lat-dialog'],
  layer_assembly_sidebar: ['.layer-workshop-sidebar'],
  layer_assembly_workspace: ['.lw-workspace-column'],
  layer_assembly_inspector: ['.lw-right-panel', '.lw-right-column'],
  layer_assembly_tools: ['.workshop-tools', '.lw-tools'],
  layer_assembly_header: ['.workshop-header', '.layer-workshop-header'],
  layer_assembly_toolbar: region('layer_assembly_toolbar', '.lw-tools'),
  layer_assembly_viewport_2d: region('layer_assembly_viewport_2d'),
  layer_assembly_viewport_3d: region('layer_assembly_viewport_3d'),
  layer_assembly_layers: region('layer_assembly_layers', '.lw-layer-stack'),
  layer_assembly_parts: region('layer_assembly_parts', '.lw-parts-panel'),
  layer_assembly_properties: region('layer_assembly_properties', '.lw-props-panel'),
  layer_assembly_swap: region('layer_assembly_swap', '.lw-swap-modal'),
  layer_assembly_rig_panel: region('layer_assembly_rig_panel', '.lw-rig-panel'),
  layer_assembly_mixamo_card: region('layer_assembly_mixamo_card', '.lw-mixamo-card'),
  layer_assembly_mixamo_studio: region('layer_assembly_mixamo_studio', '.lw-mixamo-motion-modal'),
  layer_assembly_mixamo_header: region('layer_assembly_mixamo_header', '.mx-header'),
  layer_assembly_mixamo_stage: region('layer_assembly_mixamo_stage', '.mx-stage'),
  layer_assembly_mixamo_toolbar: region('layer_assembly_mixamo_toolbar', '.mx-placer-toolbar'),
  layer_assembly_mixamo_canvas: region('layer_assembly_mixamo_canvas', '.mx-character-stage'),
  layer_assembly_mixamo_coords: region('layer_assembly_mixamo_coords', '.mx-placer-coords'),
  layer_assembly_mixamo_guide: region('layer_assembly_mixamo_guide', '.lw-mixamo-reference-guide', '.mx-reference-guide'),
  layer_assembly_mixamo_sidebar: region('layer_assembly_mixamo_sidebar', '.mx-side'),
  layer_assembly_mixamo_preview: region('layer_assembly_mixamo_preview', '.mx-preview-card'),
  layer_assembly_mixamo_angles: region('layer_assembly_mixamo_angles', '.mx-card:has(.mx-angle-grid)', '.mx-angle-grid'),
  layer_assembly_mixamo_presets: region('layer_assembly_mixamo_presets', '.mx-card:has(.mx-preset-grid)', '.mx-preset-grid'),
  layer_assembly_mixamo_settings: region('layer_assembly_mixamo_settings', '.mx-card:has(.mx-form-grid)', '.mx-form-grid'),
  layer_assembly_mixamo_footer: region('layer_assembly_mixamo_footer', '.mx-footer'),
  layer_assembly_animation_panel: region('layer_assembly_animation_panel'),
  layer_assembly_retarget: region('layer_assembly_retarget'),
  layer_assembly_create: region('layer_assembly_create'),
  layer_assembly_confirm: region('layer_assembly_confirm', '.lw-confirm-modal'),
  layer_assembly_cutter: ['.layer-cutter-split-container'],
  layer_assembly_source: ['.layer-cutter-pane.left-pane'],
  layer_assembly_target: ['.layer-cutter-target-container'],
  layer_assembly_motion_sketch: ['.lw-motion-sketch-card', '.lw-motion-sketch-overlay'],
  layer_assembly_anim_tools: ['.lw-anim-assist-card', '.lw-secondary-card', '.lw-anim-chips'],
  layer_assembly_anim_chips: ['.lw-anim-chips'],
  layer_assembly_anim_assist: ['.lw-anim-assist-card'],
  layer_assembly_anim_secondary: ['.lw-secondary-card'],
  layer_assembly_plant_motion: ['.lw-plant-motion', '.lw-plant-panel', '.lw-plant-motion-chips'],
  layer_assembly_plant_chips: ['.lw-plant-motion-chips'],
  layer_assembly_plant_panel: ['.lw-plant-panel'],

  // 3. Audio Studio (Phòng thu Âm thanh)
  audio_studio: ['.audio-studio-modal', '.audio-studio-dialog'],
  audio_studio_sidebar: ['.audio-track-list', '.audio-studio-track-list'],
  audio_studio_editor: ['.audio-track-editor'],
  audio_studio_waveform: ['.audio-waveform-panel'],
  audio_studio_tone: ['.audio-tone-panel'],
  audio_studio_mixer: ['.audio-levels-panel'],
  audio_studio_console: ['.audio-multitrack-console', '.audio-levels-panel'],

  // 4. Hộp thoại Hiệu năng (Performance Dialog)
  perf_dialog: ['.perf-modal', '.modal:has(.hw-grid)'],
  perf_hardware: ['.hw-grid'],
  perf_meter: ['.perf-meter'],
  perf_settings: ['.perf-auto-box', '.perf-preset-grid'],

  // 5. Hộp thoại Xuất video (Export Dialog)
  export: ['.export-modal', '.modal:has(#export-start)', '.modal[aria-labelledby="export-title"]'],
  export_dialog: ['.export-modal', '.modal:has(#export-start)', '.modal[aria-labelledby="export-title"]'],
  export_preview: ['.export-preview'],

  // 6. Hộp thoại Vẽ đường bay Camera (Camera Sketch Dialog)
  camera_sketch: ['.camera-sketch-modal'],
  camera_sketch_canvas: ['.camera-sketch-canvas'],
  camera_sketch_sidebar: ['.camera-sketch-sidebar'],
  camera_sketch_waypoints: ['.camera-sketch-shot-pills', '.camera-sketch-modal'],

  // 7. Hộp thoại Lộ trình Camera (Camera Path Dialog)
  camera_path: ['.camera-path-modal', '.modal[aria-labelledby="path-title"]'],
  camera_path_presets: ['.path-preset-bar', '.camera-path-modal'],
  camera_path_steps: ['.path-steps'],

  // 8. Hộp thoại MCP (MCP & AI Guide Dialog)
  mcp_dialog: ['.mcp-modal', '.modal:has(#mcp-chip)'],
  mcp_status: ['.mcp-status-card'],
  mcp_config: ['.mcp-ide-config'],
  mcp_guide: ['.mcp-ai-guide-card'],

  // AI Neon HUD
  ai_hud: ['.ai-neon-hud-badge']
}

export function isVisible(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
}

/** z-index hiệu lực lớn nhất trên chuỗi tổ tiên (stacking context xấp xỉ). */
function effectiveZIndex(el: HTMLElement): number {
  let max = 0
  for (let node: HTMLElement | null = el; node; node = node.parentElement) {
    const z = Number.parseInt(getComputedStyle(node).zIndex, 10)
    if (Number.isFinite(z) && z > max) max = z
  }
  return max
}

/**
 * Tìm dialog/modal đang hiển thị TRÊN CÙNG. Thứ tự ưu tiên: z-index hiệu lực cao hơn → nằm sau trong DOM
 * (dialog lồng bên trong luôn nằm sau dialog cha) → diện tích nhỏ hơn.
 */
export function findActiveDialog(root: Pick<Document, 'querySelectorAll'> = document): HTMLElement | null {
  if (typeof root?.querySelectorAll !== 'function') return null
  let all: HTMLElement[]
  try {
    all = Array.from(root.querySelectorAll<HTMLElement>(DIALOG_SELECTORS.join(',')))
  } catch {
    return null
  }
  const ranked = all
    .map((el, order) => ({ el, order, rect: el.getBoundingClientRect() }))
    .filter(({ el, rect }) => rect.width >= 80 && rect.height >= 60 && isVisible(el))
    .map((c) => ({ ...c, z: effectiveZIndex(c.el), area: c.rect.width * c.rect.height }))
  if (!ranked.length) return null
  ranked.sort((a, b) => b.z - a.z || b.order - a.order || a.area - b.area)
  return ranked[0].el
}

function firstVisible(sel: string): HTMLElement | null {
  try {
    const el = document.querySelector<HTMLElement>(sel)
    return el && isVisible(el) ? el : null
  } catch {
    return null
  }
}

export const REGION_ALIASES: Record<string, string> = {
  mixamo: 'layer_assembly_mixamo_studio',
  mixamo_studio: 'layer_assembly_mixamo_studio',
  mixamo_header: 'layer_assembly_mixamo_header',
  mixamo_stage: 'layer_assembly_mixamo_stage',
  mixamo_toolbar: 'layer_assembly_mixamo_toolbar',
  mixamo_canvas: 'layer_assembly_mixamo_canvas',
  mixamo_coords: 'layer_assembly_mixamo_coords',
  mixamo_guide: 'layer_assembly_mixamo_guide',
  mixamo_sidebar: 'layer_assembly_mixamo_sidebar',
  mixamo_preview: 'layer_assembly_mixamo_preview',
  mixamo_angles: 'layer_assembly_mixamo_angles',
  mixamo_presets: 'layer_assembly_mixamo_presets',
  mixamo_settings: 'layer_assembly_mixamo_settings',
  mixamo_footer: 'layer_assembly_mixamo_footer',
  parts: 'layer_assembly_parts',
  swap: 'layer_assembly_swap'
}

export function resolveTargetElement(regionName?: string, selector?: string): HTMLElement | null {
  if (selector) {
    const el = firstVisible(selector)
    if (el) return el
  }
  if (!regionName || regionName === 'window') return null
  const targetRegion = REGION_ALIASES[regionName] || regionName
  if (targetRegion === ACTIVE_REGION || targetRegion === 'dialog') {
    const top = findActiveDialog()
    if (top) return top
  }
  const candidates = UI_REGION_SELECTORS[targetRegion] || [`.${targetRegion}`, `#${targetRegion}`]
  for (const sel of [...candidates, `[data-mcp-region="${targetRegion}"]`]) {
    const el = firstVisible(sel)
    if (el) return el
  }
  return null
}

/** Mô tả ngắn phần tử đã chụp để AI biết chính xác vùng nào được crop. */
export function describeElement(el: HTMLElement): { region?: string; className?: string } {
  const regionAttr = el.getAttribute?.('data-mcp-region') ?? undefined
  const cls = typeof el.className === 'string' ? el.className.split(/\s+/).filter(Boolean).slice(0, 3).join(' ') : undefined
  return { region: regionAttr || undefined, className: cls || undefined }
}
