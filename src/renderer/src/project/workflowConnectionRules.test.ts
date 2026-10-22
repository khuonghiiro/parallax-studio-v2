import { describe, expect, it } from 'vitest'
import type { WorkflowNode } from '@shared/types'
import { validateWorkflowConnection } from './workflowConnectionRules'

function mockNode(base: Partial<WorkflowNode> & { id: string; type: any; title: string }): WorkflowNode {
  return {
    enabled: true,
    preset: 'default',
    aiAgentRole: 'SceneLayoutAgent',
    aiDirective: 'test',
    position: { x: 0, y: 0 },
    ...base
  }
}

describe('validateWorkflowConnection', () => {
  const sceneNode = mockNode({
    id: 'wf-scene-1',
    type: 'scene_shot',
    title: 'Phân cảnh 1',
    position: { x: 0, y: 0 }
  })

  const layerNodeA = mockNode({
    id: 'wf-layer-1',
    type: 'layer_assembly',
    title: 'Nhân vật chính',
    position: { x: 300, y: 0 },
    params: { targetLayerIds: ['layer-1'] }
  })

  const layerNodeB = mockNode({
    id: 'wf-layer-2',
    type: 'layer_assembly',
    title: 'Cây cối',
    position: { x: 300, y: 200 },
    params: { targetLayerIds: ['layer-2'] }
  })

  const transformNodeA = mockNode({
    id: 'wf-transform-1',
    type: 'layer_transform',
    title: 'Tọa độ Z',
    position: { x: 300, y: 400 },
    params: { targetLayerIds: ['layer-1'] }
  })

  const transformNodeB = mockNode({
    id: 'wf-transform-2',
    type: 'layer_transform',
    title: 'Tọa độ Z (B)',
    position: { x: 300, y: 600 },
    params: { targetLayerIds: ['layer-2'] }
  })

  const motionNode = mockNode({
    id: 'wf-motion-1',
    type: 'motion_choreography',
    title: 'Chuyển động',
    position: { x: 600, y: 0 }
  })

  const fxNode = mockNode({
    id: 'wf-fx-1',
    type: 'physics_fx',
    title: 'Vật lý & FX',
    position: { x: 900, y: 0 }
  })

  const camNode = mockNode({
    id: 'wf-cam-1',
    type: 'camera_director',
    title: 'Camera',
    position: { x: 600, y: 300 }
  })

  it('từ chối kết nối một khối vào chính nó', () => {
    const res = validateWorkflowConnection(layerNodeA, 'actors_rig', layerNodeA, 'vfx_stage')
    expect(res.valid).toBe(false)
    expect(res.reason).toContain('chính nó')
  })

  it('CẤM Layer nối sang Layer bằng các cổng ngang thông thường (vfx_stage, motion_stream, scene_ctx)', () => {
    const res1 = validateWorkflowConnection(layerNodeA, 'vfx_stage', layerNodeB, 'vfx_stage')
    expect(res1.valid).toBe(false)
    expect(res1.reason).toContain('Không thể nối trực tiếp giữa hai Layer qua cổng ngang')

    const res2 = validateWorkflowConnection(layerNodeA, 'motion_stream', layerNodeB, 'motion_stream')
    expect(res2.valid).toBe(false)

    const res3 = validateWorkflowConnection(layerNodeA, 'actors_rig', layerNodeB, 'actors_rig')
    expect(res3.valid).toBe(false)
  })

  it('CHO PHÉP Layer Cha nối vào cổng đỉnh [layers_tree] của Layer Con để tạo quan hệ Cha - Con (Parent & Link)', () => {
    const res = validateWorkflowConnection(layerNodeA, 'actors_rig', layerNodeB, 'layers_tree')
    expect(res.valid).toBe(true)
    expect(res.isParentChildLink).toBe(true)
  })

  it('cho phép Scene phân phối xuống Layer qua layers_tree', () => {
    const res = validateWorkflowConnection(sceneNode, 'layers_tree', layerNodeA, 'layers_tree')
    expect(res.valid).toBe(true)
  })

  it('cho phép Layer nối xuống đúng Transform Plate của chính nó qua transform_link', () => {
    const res = validateWorkflowConnection(layerNodeA, 'transform_link', transformNodeA, 'transform_link')
    expect(res.valid).toBe(true)
  })

  it('từ chối Layer nối sang Transform Plate của Layer khác qua transform_link', () => {
    const res = validateWorkflowConnection(layerNodeA, 'transform_link', transformNodeB, 'transform_link')
    expect(res.valid).toBe(false)
    expect(res.reason).toContain('chỉ được liên kết với đúng Layer chủ quản')
  })

  it('cho phép Layer xuất actors_rig sang Motion, FX, Camera', () => {
    expect(validateWorkflowConnection(layerNodeA, 'actors_rig', motionNode, 'actors_rig').valid).toBe(true)
    expect(validateWorkflowConnection(layerNodeA, 'actors_rig', fxNode, 'actors_rig').valid).toBe(true)
    expect(validateWorkflowConnection(layerNodeA, 'actors_rig', camNode, 'actors_rig').valid).toBe(true)
  })

  it('cho phép Motion xuất motion_stream sang Layer hoặc FX', () => {
    expect(validateWorkflowConnection(motionNode, 'motion_stream', layerNodeA, 'motion_stream').valid).toBe(true)
    expect(validateWorkflowConnection(motionNode, 'motion_stream', fxNode, 'motion_stream').valid).toBe(true)
  })

  it('cho phép FX xuất vfx_stage sang Layer', () => {
    expect(validateWorkflowConnection(fxNode, 'vfx_stage', layerNodeA, 'vfx_stage').valid).toBe(true)
  })
  it('không tráo ngữ cảnh cảnh sang cổng chuyển động hoặc tráo đối tượng sang camera', () => {
    expect(validateWorkflowConnection(sceneNode, 'scene_ctx', fxNode, 'motion_stream').valid).toBe(false)
    expect(validateWorkflowConnection(layerNodeA, 'actors_rig', camNode, 'camera_cut').valid).toBe(false)
    expect(validateWorkflowConnection(camNode, 'camera_cut', { ...camNode, id: 'modifier' }, 'camera_cut').valid).toBe(true)
  })

  it('từ chối nối chéo cổng ngang vào cổng dọc', () => {
    const res = validateWorkflowConnection(motionNode, 'motion_stream', layerNodeA, 'transform_link')
    expect(res.valid).toBe(false)
  })
})
