import { getWorkflowNodePorts } from './workflowNodePorts'
import type {
  WorkflowNode,
  WorkflowNodeType,
  WorkflowPortKind
} from '@shared/types'

export interface ConnectionValidationResult {
  valid: boolean
  reason?: string
  isParentChildLink?: boolean
}

/**
 * Ma trận kiểm tra tính tương thích ngữ nghĩa giữa các Cổng và Khối trong Parallax Studio.
 * Ngăn chặn tuyệt đối việc nối tùy tiện sai bản chất nghiệp vụ (như Layer nối sang Layer bằng cổng VFX).
 */
export function validateWorkflowConnection(
  fromNode: WorkflowNode,
  fromPort: WorkflowPortKind,
  toNode: WorkflowNode,
  toPort: WorkflowPortKind
): ConnectionValidationResult {
  const fromShot = fromNode.params?.shotId
  const toShot = toNode.params?.shotId
  if (fromShot && toShot && fromShot !== 'all' && toShot !== 'all' && fromShot !== toShot) {
    return { valid: false, reason: 'Hai node thuộc hai phân cảnh khác nhau.' }
  }
  // 1. Không cho phép nối một Khối vào chính nó
  if (fromNode.id === toNode.id) {
    return {
      valid: false,
      reason: 'Không thể nối một Khối vào chính nó.'
    }
  }

  // 2. Không cho phép nối chéo giữa cổng dọc (Vertical Tree/Tether) và cổng ngang (Horizontal Stream)
  const isFromVertical = fromPort === 'layers_tree' || fromPort === 'transform_link'
  const isToVertical = toPort === 'layers_tree' || toPort === 'transform_link'
  if (isFromVertical !== isToVertical && !(fromPort === 'actors_rig' && toPort === 'layers_tree')) {
    return {
      valid: false,
      reason: 'Không thể nối chéo giữa Cổng Phân Cấp Dọc (Đỉnh/Đáy) và Cổng Luồng Ngang.'
    }
  }

  // 3. Quy tắc riêng cho cổng thước đo Tọa độ Transform Plate (transform_link)
  if (fromPort === 'transform_link' || toPort === 'transform_link') {
    if (fromNode.type !== 'layer_assembly' || toNode.type !== 'layer_transform') {
      return {
        valid: false,
        reason: 'Cổng [Tọa độ 2.5D] chỉ dành riêng để liên kết giữa Thẻ Layer và Tấm điều khiển Transform của chính nó.'
      }
    }
    const fromLayerId = fromNode.params?.targetLayerIds?.[0]
    const toLayerId = toNode.params?.targetLayerIds?.[0]
    if (fromLayerId && toLayerId && fromLayerId !== toLayerId) {
      return {
        valid: false,
        reason: 'Tấm điều khiển Tọa độ Transform chỉ được liên kết với đúng Layer chủ quản của nó.'
      }
    }
    return { valid: true }
  }

  // 4. QUY TẮC KẾT NỐI GIỮA LAYER VÀ LAYER (Layer-to-Layer Connection):
  // Giữa 2 Layer với nhau CHỈ DUY NHẤT một logic hợp lệ:
  // Quan hệ Cha - Con (Parent & Link): Layer Con chuyển động bám dính theo Layer Cha!
  if (fromNode.type === 'layer_assembly' && toNode.type === 'layer_assembly') {
    if (toPort === 'layers_tree') {
      return {
        valid: true,
        isParentChildLink: !toNode.params?.assemblyRootNodeId
      }
    }
    const isAtomicModifier = Boolean(fromNode.params?.logicId) !== Boolean(toNode.params?.logicId)
    if (!isAtomicModifier) {
      return {
        valid: false,
        reason: 'Không thể nối trực tiếp giữa hai Layer qua cổng ngang. Hãy kéo từ cổng ra của Layer Cha vào cổng đỉnh [🌲 Tầng Layer] của Layer Con nếu muốn tạo quan hệ Cha - Con (Parent & Link).'
      }
    }
  }

  if (!getWorkflowNodePorts(fromNode).outputs.includes(fromPort) || !getWorkflowNodePorts(toNode).inputs.includes(toPort)) {
    return { valid: false, reason: 'Cổng không tồn tại trên node nguồn hoặc node đích.' }
  }

  // 5. Cổng Cây Phân Cấp (layers_tree)
  if (toPort === 'layers_tree') {
    // Chỉ nhận từ Scene Shot (Cảnh gốc) hoặc từ Layer Cha (Parent Layer)
    if (fromNode.type === 'scene_shot') {
      if (toNode.type === 'layer_assembly') {
        return { valid: true }
      }
      return {
        valid: false,
        reason: 'Cổng [Tầng Layer] của Cảnh chỉ phân phối xuống các Thẻ Layer con.'
      }
    }
    if (fromNode.type === 'layer_assembly') {
      return { valid: true, isParentChildLink: true }
    }
    return {
      valid: false,
      reason: 'Cổng đỉnh [Tầng Layer] chỉ nhận phân cấp từ Khối Cảnh hoặc từ Layer Cha.'
    }
  }

  // 6. Cổng Ngữ cảnh Phân cảnh (scene_ctx)
  if (fromPort === 'scene_ctx' || toPort === 'scene_ctx') {
    if (fromPort !== 'scene_ctx' || toPort !== 'scene_ctx') {
      return { valid: false, reason: 'Ngữ cảnh cảnh chỉ nối với cổng Ngữ cảnh cảnh; không thay thế luồng chuyển động hoặc hiệu ứng.' }
    }
    if (fromNode.type !== 'scene_shot') {
      return {
        valid: false,
        reason: 'Chỉ có Khối Phân Cảnh (Scene Shot) mới cung cấp Ngữ cảnh Cảnh 3D.'
      }
    }
    const validTargets: WorkflowNodeType[] = [
      'scene_shot',
      'layer_assembly',
      'camera_director',
      'motion_choreography',
      'physics_fx',
      'audio_lipsync',
      'look_output'
    ]
    if (!validTargets.includes(toNode.type)) {
      return {
        valid: false,
        reason: 'Khối đích không nhận Ngữ cảnh Cảnh 3D.'
      }
    }
    return { valid: true }
  }

  // 7. Cổng Luồng Chuyển động (motion_stream)
  if (toPort === 'motion_stream') {
    const validMotionSources: WorkflowNodeType[] = ['motion_choreography']
    const isMotionSource =
      validMotionSources.includes(fromNode.type) || Boolean(fromNode.params?.logicId?.includes('motion'))
    if (!isMotionSource && fromNode.type !== 'motion_choreography') {
      return {
        valid: false,
        reason: 'Cổng [Chuyển động] chỉ nhận luồng từ Khối Chuyển động & Diễn hoạt.'
      }
    }
    return { valid: true }
  }

  // 8. Cổng Vật lý & Ánh sáng FX (vfx_stage)
  if (toPort === 'vfx_stage') {
    const validFxSources: WorkflowNodeType[] = ['physics_fx']
    const isFxSource =
      validFxSources.includes(fromNode.type) || Boolean(fromNode.params?.logicId?.includes('vfx') || fromNode.params?.logicId?.includes('light'))
    if (!isFxSource && fromNode.type !== 'physics_fx') {
      return {
        valid: false,
        reason: 'Cổng [Vật lý/FX] chỉ nhận hiệu ứng từ Khối Vật lý, Ánh sáng & FX.'
      }
    }
    return { valid: true }
  }

  // 9. Cổng Thực thể / Diễn viên (actors_rig)
  if (fromPort === 'actors_rig') {
    if (toPort !== 'actors_rig') return { valid: false, reason: 'Luồng đối tượng chỉ nối vào cổng Đối tượng.' }
    if (fromNode.type !== 'layer_assembly') {
      return {
        valid: false,
        reason: 'Chỉ có Thẻ Layer 2.5D mới cung cấp Thực thể Đối tượng (Actors & Rig).'
      }
    }
    const validRigReceivers: WorkflowNodeType[] = [
      'motion_choreography',
      'physics_fx',
      'camera_director',
      'audio_lipsync',
      'layer_assembly'
    ]
    if (!validRigReceivers.includes(toNode.type)) {
      return {
        valid: false,
        reason: 'Khối đích không nhận Thực thể Đối tượng.'
      }
    }
    return { valid: true }
  }

  // 10. Cổng Âm thanh (audio_mix)
  if (toPort === 'audio_mix') {
    if (fromNode.type !== 'audio_lipsync') {
      return {
        valid: false,
        reason: 'Cổng [Thoại/Audio] chỉ nhận âm thanh từ Khối Âm thanh & Lip-sync.'
      }
    }
    return { valid: true }
  }

  // 11. Cổng Lộ trình Camera (camera_cut)
  if (fromPort === 'camera_cut' || toPort === 'camera_cut') {
    if (fromPort !== 'camera_cut' || toPort !== 'camera_cut' || fromNode.type !== 'camera_director'
      || !['look_output', 'camera_director'].includes(toNode.type)) {
      return {
        valid: false,
        reason: 'Cổng [Lộ trình Cam] chỉ truyền từ Camera sang Camera modifier hoặc Khối Xuất Bản.'
      }
    }
    return { valid: true }
  }

  // Khớp chính xác tên cổng chuẩn theo logic danh mục
  if ((fromPort as string) === (toPort as string)) {
    return { valid: true }
  }

  return {
    valid: false,
    reason: `Cổng xuất [${fromPort}] không tương thích với cổng nhập [${toPort}].`
  }
}
