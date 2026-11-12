import { useEditor } from '../../store/editor'
import type { ScannedElementContext } from './aiUiInspectorScanner'
import type { ScannedSceneEntityInfo } from './aiUiInspectorSceneAndWorkflowContext'
import type { Scanned25DBoneInfo, Scanned25DPartInfo } from './aiUiInspectorWorkshopContext'

export interface ElementActiveFocusState {
  isFocused: boolean
  isActive: boolean
  focusReason: 'active_element' | 'bbox_focused' | 'keyboard_focus' | 'scene_focus' | 'workshop_focus' | null
  activeReason:
    | 'class_active'
    | 'aria_selected'
    | 'aria_current'
    | 'data_active'
    | 'selected_layer'
    | 'selected_shot'
    | 'workshop_selected'
    | null
  activeStateLabel: string | null
  score: number
}

function getSelectedIdsFromStore(): { selectedLayerId: string | null; selectedShotId: string | null } {
  try {
    const state = useEditor.getState?.()
    return {
      selectedLayerId: state?.selectedLayerId || null,
      selectedShotId: state?.selectedShotId || null
    }
  } catch {
    return { selectedLayerId: null, selectedShotId: null }
  }
}

/**
 * Tính điểm tương tác focus/active của phần tử DOM để ưu tiên khi tìm kiếm và xếp hạng.
 */
export function getElementInteractionScore(el: Element): number {
  if (!el) return 0
  let score = 0

  // 1. Browser DOM Focus (document.activeElement)
  try {
    if (typeof document !== 'undefined' && document.activeElement && document.activeElement !== document.body) {
      if (document.activeElement === el) score += 100
      else if (el.contains?.(document.activeElement)) score += 80
    }
  } catch {
    /* ignore */
  }

  // 2. Direct BBox Focus & Data Focus
  if (el.getAttribute?.('data-bbox-focused') === 'true' || el.getAttribute?.('data-focused') === 'true') {
    score += 90
  }

  // 3. Classes
  const classes = Array.from(el.classList || [])
  if (classes.some((c) => c === 'active' || c === 'is-active')) score += 60
  else if (classes.some((c) => c === 'selected' || c === 'is-selected')) score += 55
  else if (classes.some((c) => c === 'current' || c === 'is-current')) score += 45

  // 4. ARIA
  if (el.getAttribute?.('aria-selected') === 'true') score += 50
  if (el.getAttribute?.('aria-current') === 'page' || el.getAttribute?.('aria-current') === 'true') score += 45
  if (el.getAttribute?.('aria-pressed') === 'true' || el.getAttribute?.('aria-expanded') === 'true') score += 35

  // 5. Data Attributes
  if (
    el.getAttribute?.('data-active') === 'true' ||
    el.getAttribute?.('data-state') === 'active' ||
    el.getAttribute?.('data-state') === 'checked'
  ) {
    score += 45
  }
  if (el.getAttribute?.('data-selected') === 'true') score += 40

  // 6. Selected Layer / Shot in Editor
  const { selectedLayerId, selectedShotId } = getSelectedIdsFromStore()
  if (selectedLayerId && el.getAttribute?.('data-layer-id') === selectedLayerId) score += 65
  if (selectedShotId && el.getAttribute?.('data-shot-id') === selectedShotId) score += 60

  return score
}

/**
 * Phân tích và phát hiện chính xác trạng thái Focus và Active của phần tử trong Parallax Studio.
 */
export function detectElementActiveFocus(
  el: Element,
  meta?: {
    sceneEntity?: ScannedSceneEntityInfo | null
    part25D?: Scanned25DPartInfo | null
    bone25D?: Scanned25DBoneInfo | null
  }
): ElementActiveFocusState {
  let isFocused = false
  let isActive = false
  let focusReason: ElementActiveFocusState['focusReason'] = null
  let activeReason: ElementActiveFocusState['activeReason'] = null

  // 1. Kiểm tra DOM Focus (activeElement)
  if (typeof document !== 'undefined' && document.activeElement && document.activeElement !== document.body) {
    if (document.activeElement === el) {
      isFocused = true
      focusReason = 'active_element'
    } else if (el.contains?.(document.activeElement)) {
      isFocused = true
      focusReason = 'keyboard_focus'
    }
  }

  // 2. Kiểm tra BBox & 3D Scene focus
  if (!isFocused) {
    if (el.getAttribute?.('data-bbox-focused') === 'true' || el.getAttribute?.('data-focused') === 'true') {
      isFocused = true
      focusReason = 'bbox_focused'
    } else if (meta?.sceneEntity?.isFocused) {
      isFocused = true
      focusReason = 'scene_focus'
    }
  }

  // 3. Kiểm tra Active qua Class
  const classes = Array.from(el.classList || [])
  if (classes.some((c) => c === 'active' || c === 'is-active')) {
    isActive = true
    activeReason = 'class_active'
  } else if (classes.some((c) => c === 'selected' || c === 'is-selected')) {
    isActive = true
    activeReason = 'class_active'
  } else if (classes.some((c) => c === 'current' || c === 'is-current')) {
    isActive = true
    activeReason = 'class_active'
  }

  // 4. Kiểm tra Active qua ARIA
  if (!isActive) {
    if (el.getAttribute?.('aria-selected') === 'true') {
      isActive = true
      activeReason = 'aria_selected'
    } else if (el.getAttribute?.('aria-current') === 'page' || el.getAttribute?.('aria-current') === 'true') {
      isActive = true
      activeReason = 'aria_current'
    } else if (el.getAttribute?.('aria-pressed') === 'true') {
      isActive = true
      activeReason = 'aria_selected'
    }
  }

  // 5. Kiểm tra Active qua Data attributes
  if (!isActive) {
    if (
      el.getAttribute?.('data-active') === 'true' ||
      el.getAttribute?.('data-state') === 'active' ||
      el.getAttribute?.('data-state') === 'checked'
    ) {
      isActive = true
      activeReason = 'data_active'
    } else if (el.getAttribute?.('data-selected') === 'true') {
      isActive = true
      activeReason = 'data_active'
    }
  }

  // 6. Kiểm tra Active qua Store / Xưởng
  const { selectedLayerId, selectedShotId } = getSelectedIdsFromStore()
  if (!isActive) {
    if (
      (selectedLayerId && el.getAttribute?.('data-layer-id') === selectedLayerId) ||
      (selectedLayerId && meta?.sceneEntity?.layerId === selectedLayerId)
    ) {
      isActive = true
      activeReason = 'selected_layer'
    } else if (selectedShotId && el.getAttribute?.('data-shot-id') === selectedShotId) {
      isActive = true
      activeReason = 'selected_shot'
    } else if (meta?.part25D?.isSelected || meta?.bone25D?.isSelected) {
      isActive = true
      activeReason = 'workshop_selected'
    }
  }

  let activeStateLabel: string | null = null
  if (isFocused && isActive) {
    activeStateLabel = '🎯 Focus & ⭐ Active'
  } else if (isFocused) {
    activeStateLabel = '🎯 Đang Focus'
  } else if (isActive) {
    activeStateLabel = '⭐ Đang Active'
  }

  const score = getElementInteractionScore(el) + (isFocused ? 100 : 0) + (isActive ? 50 : 0)

  return {
    isFocused,
    isActive,
    focusReason,
    activeReason,
    activeStateLabel,
    score
  }
}

/**
 * Sắp xếp và xác định mục tiêu trọng tâm (Primary Focus) chuẩn xác nhất dựa trên trạng thái Focus & Active.
 * Phần tử đang Focus hoặc đang Active sẽ được ưu tiên đưa lên vị trí đầu tiên (index 0).
 */
export function rankAndDesignatePrimaryFocus(items: ScannedElementContext[]): ScannedElementContext[] {
  if (items.length === 0) return items

  // Tính điểm tổng thể cho từng item
  const scoredItems = items.map((item, originalIndex) => {
    let rankScore = 0
    if (item.isFocused) rankScore += 200
    if (item.isActive) rankScore += 100
    if (item.sceneEntity?.isFocused) rankScore += 180
    if (item.part25D?.isSelected || item.bone25D?.isSelected) rankScore += 90
    // Trừ dần theo vị trí hình học ban đầu để giữ ổn định
    rankScore -= originalIndex * 2
    return { item, rankScore }
  })

  // Sắp xếp giảm dần theo rankScore
  scoredItems.sort((a, b) => b.rankScore - a.rankScore)
  const sorted = scoredItems.map((s) => s.item)

  // Gán isPrimaryFocus duy nhất cho phần tử đứng đầu
  sorted.forEach((item, idx) => {
    item.isPrimaryFocus = idx === 0
  })

  return sorted
}

