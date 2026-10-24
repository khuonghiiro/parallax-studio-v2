import type { WorkflowNode, WorkflowPortKind } from '@shared/types'
import { getWorkflowNodePorts } from '../../project/workflowNodePorts'
import { validateWorkflowConnection } from '../../project/workflowConnectionRules'
import {
  NODE_W,
  estimateNodeCardHeight,
  getInputSocketCoords,
  getOutputSocketCoords,
  getBestMatchingInputPort,
  getBestMatchingOutputPort
} from './workflowLayoutAndFlow'

export const SNAP_RADIUS = 60

export interface MagneticTargetResult {
  nodeId: string
  port: WorkflowPortKind
  isInput: boolean
  x: number
  y: number
  targetCardOnly?: boolean
}

/**
 * Tìm chân cắm mục tiêu hoặc Thẻ khối đích gần nhất để hút nam châm (Magnetic Snap).
 * Hỗ trợ 2 chiều: Kéo từ Output ➔ hút Input; Kéo từ Input ➔ hút Output.
 * Đồng thời hỗ trợ thả dây trực tiếp lên bất kỳ vị trí nào trên thẻ khối đích (Whole Card Drop)!
 */
export function findMagneticTarget(
  worldX: number,
  worldY: number,
  sourceNodeId: string,
  sourcePort: WorkflowPortKind,
  isSourceOutput: boolean,
  effectiveNodes: WorkflowNode[]
): MagneticTargetResult | null {
  const sourceNode = effectiveNodes.find((n) => n.id === sourceNodeId)
  if (!sourceNode) return null

  let bestSocket: {
    nodeId: string
    port: WorkflowPortKind
    isInput: boolean
    x: number
    y: number
    dist: number
  } | null = null

  // 1. Kiểm tra khoảng cách tới tất cả các chân cắm phù hợp của các khối khác
  for (const n of effectiveNodes) {
    if (n.id === sourceNodeId) continue
    const spec = getWorkflowNodePorts(n)
    if (!spec) continue

    const targetPorts = isSourceOutput ? spec.inputs : spec.outputs
    if (targetPorts.length === 0) continue

    for (const targetPort of targetPorts) {
      // Thẩm định tính hợp lệ theo quy tắc logic nghiệp vụ trước khi bắt điểm
      const validation = isSourceOutput
        ? validateWorkflowConnection(sourceNode, sourcePort, n, targetPort)
        : validateWorkflowConnection(n, targetPort, sourceNode, sourcePort)
      if (!validation.valid) continue

      const coords = isSourceOutput
        ? getInputSocketCoords(n, targetPort)
        : getOutputSocketCoords(n, targetPort)
      const dist = Math.hypot(coords.x - worldX, coords.y - worldY)
      const effectiveDist = targetPort === sourcePort ? dist * 0.7 : dist
      if (dist <= SNAP_RADIUS && (!bestSocket || effectiveDist < bestSocket.dist)) {
        bestSocket = {
          nodeId: n.id,
          port: targetPort,
          isInput: isSourceOutput,
          x: coords.x,
          y: coords.y,
          dist: effectiveDist
        }
      }
    }
  }
  if (bestSocket) {
    return {
      nodeId: bestSocket.nodeId,
      port: bestSocket.port,
      isInput: bestSocket.isInput,
      x: bestSocket.x,
      y: bestSocket.y
    }
  }

  // 2. Thả dây vào BẤT KỲ ĐÂU trên thẻ Khối đích (Whole Card Drop Hitbox)
  for (const n of effectiveNodes) {
    if (n.id === sourceNodeId) continue
    const spec = getWorkflowNodePorts(n)
    if (!spec) continue
    const cardH = estimateNodeCardHeight(n)
    if (
      worldX >= n.position.x - 24 &&
      worldX <= n.position.x + NODE_W + 24 &&
      worldY >= n.position.y - 16 &&
      worldY <= n.position.y + cardH + 24
    ) {
      if (isSourceOutput) {
        const bestPort = getBestMatchingInputPort(sourcePort, n, sourceNode)
        if (bestPort) {
          const coords = getInputSocketCoords(n, bestPort)
          return { nodeId: n.id, port: bestPort, isInput: true, x: coords.x, y: coords.y, targetCardOnly: true }
        }
      } else {
        const bestPort = getBestMatchingOutputPort(sourcePort, n, sourceNode)
        if (bestPort) {
          const coords = getOutputSocketCoords(n, bestPort)
          return { nodeId: n.id, port: bestPort, isInput: false, x: coords.x, y: coords.y, targetCardOnly: true }
        }
      }
    }
  }

  return null
}
