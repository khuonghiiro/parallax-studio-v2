import { produce } from 'immer'
import { describe, expect, it } from 'vitest'
import type { Project, WorkflowGraph } from '@shared/types'
import { createImageLayer, createProject, createShot } from './factory'
import {
  attachLogicNodeToLayerV2,
  resolveFxAtomicRole,
  syncWorkflowV2Graph,
  syncWorkflowV2NodeToProject,
  v2LayerNodeId,
  validateWorkflowV2Connection
} from './workflowV2Engine'
import { applyWorkflowV2ToProject, deleteWorkflowV2Node, detachWorkflowV2NodeFromProject } from './workflowV2Rebuild'

function synced(project: Project): Project {
  const wf = syncWorkflowV2Graph(project, project.workflow)
  return { ...project, workflow: wf }
}

function makePipelineSample(): { proj: Project; heroId: string } {
  const proj = createProject()
  proj.comp.duration = 8
  const shot = createShot('Cảnh Pipeline')
  proj.shots.push(shot)
  const hero = createImageLayer(
    { id: 'hero-img', name: 'Kiếm Khách', kind: 'image', mime: 'image/png', width: 256, height: 256 },
    proj.comp,
    0,
    shot.id
  )
  hero.inPoint = 0
  hero.outPoint = 6
  proj.layers.push(hero)
  return { proj: synced(proj), heroId: hero.id }
}

describe('Workflow V2 — Pipeline chuỗi Node đơn nhiệm', () => {
  it('cho phép nối chuỗi Layer -> Motion (B1) -> Fade (B2) -> Pulse (B3) -> Glow (B4), lan truyền đích, xếp cột ngang và đồng bộ không trùng lặp', () => {
    let { proj, heroId } = makePipelineSample()
    const layerNodeId = v2LayerNodeId(heroId)

    const r1 = attachLogicNodeToLayerV2(proj.workflow!, layerNodeId, 'action', 'v2:action:drift')
    const r2 = attachLogicNodeToLayerV2(r1.workflow, r1.createdNodeId, 'fx', 'v2:fx:fadeInOut')
    const r3 = attachLogicNodeToLayerV2(r2.workflow, r2.createdNodeId, 'fx', 'v2:fx:pulse')
    const r4 = attachLogicNodeToLayerV2(r3.workflow, r3.createdNodeId, 'fx', 'v2:fx:neonBreathe')

    const wf = r4.workflow
    const n1 = wf.nodes.find((n) => n.id === r1.createdNodeId)!
    const n2 = wf.nodes.find((n) => n.id === r2.createdNodeId)!
    const n3 = wf.nodes.find((n) => n.id === r3.createdNodeId)!
    const n4 = wf.nodes.find((n) => n.id === r4.createdNodeId)!

    expect(n1.params?.pipelineStepIndex).toBe(1)
    expect(n2.params?.pipelineStepIndex).toBe(2)
    expect(n3.params?.pipelineStepIndex).toBe(3)
    expect(n4.params?.pipelineStepIndex).toBe(4)

    expect(n2.params?.upstreamLogicNodeId).toBe(n1.id)
    expect(n3.params?.upstreamLogicNodeId).toBe(n2.id)
    expect(n4.params?.upstreamLogicNodeId).toBe(n3.id)

    expect(n4.params?.targetLayerIds).toEqual([heroId])
    expect(n1.position.x).toBeLessThan(n2.position.x)
    expect(n2.position.x).toBeLessThan(n3.position.x)
    expect(n3.position.x).toBeLessThan(n4.position.x)
    expect(resolveFxAtomicRole(n2)).toBe('fade')
    expect(resolveFxAtomicRole(n3)).toBe('pulse')
    expect(resolveFxAtomicRole(n4)).toBe('glow')

    // Áp chuỗi xuống Layer và kiểm tra đồng bộ lại đồ thị không đẻ trùng Node trực tiếp off Layer
    proj = produce(proj, (d) => {
      d.workflow = wf
      applyWorkflowV2ToProject(d as Project, wf)
    })
    const layer = proj.layers.find((l) => l.id === heroId)!
    expect(layer.fadeIn).toBeCloseTo(0.5, 2)
    expect(layer.glow?.enabled).toBe(true)
    expect(layer.appliedEffects?.some((f) => f.presetId === 'pulse')).toBe(true)
    expect(layer.appliedEffects?.some((f) => f.presetId === 'neonBreathe')).toBe(true)

    const resynced = syncWorkflowV2Graph(proj, proj.workflow)
    const fxNodesAfter = resynced.nodes.filter((n) => n.params?.logicCategory === 'fx')
    expect(fxNodesAfter).toHaveLength(3)
    expect(resynced.edges.some((e) => e.fromNode === layerNodeId && e.toNode === n2.id)).toBe(false)
    expect(resynced.edges.some((e) => e.fromNode === n1.id && e.toNode === n2.id)).toBe(true)
  })

  it('tách bạch hoàn toàn 3 vai trò FX (fade, pulse, glow): xoá Pulse giữ nguyên Fade và Glow', () => {
    let { proj, heroId } = makePipelineSample()
    const layerNodeId = v2LayerNodeId(heroId)

    const rFade = attachLogicNodeToLayerV2(proj.workflow!, layerNodeId, 'fx', 'v2:fx:fadeIn')
    const rPulse = attachLogicNodeToLayerV2(rFade.workflow, layerNodeId, 'fx', 'v2:fx:pulse')
    const rGlow = attachLogicNodeToLayerV2(rPulse.workflow, layerNodeId, 'fx', 'v2:fx:neonBreathe')
    expect(new Set([rFade.createdNodeId, rPulse.createdNodeId, rGlow.createdNodeId]).size).toBe(3)

    // Chặn nối trùng cùng vai trò Fade thứ 2 trực tiếp vào cùng Layer
    const dupFade = validateWorkflowV2Connection(
      {
        ...rGlow.workflow,
        nodes: [
          ...rGlow.workflow.nodes,
          { ...rGlow.workflow.nodes.find((n) => n.id === rFade.createdNodeId)!, id: 'extra-fade' }
        ]
      },
      layerNodeId,
      'extra-fade'
    )
    expect(dupFade.valid).toBe(false)

    proj = produce(proj, (d) => {
      d.workflow = rGlow.workflow
      applyWorkflowV2ToProject(d as Project, d.workflow)
    })
    const pulseNode = proj.workflow!.nodes.find((n) => n.id === rPulse.createdNodeId)!
    proj = produce(proj, (d) => {
      detachWorkflowV2NodeFromProject(d as Project, pulseNode)
      d.workflow = {
        ...(d.workflow as WorkflowGraph),
        nodes: d.workflow!.nodes.filter((n) => n.id !== pulseNode.id),
        edges: d.workflow!.edges.filter((e) => e.toNode !== pulseNode.id)
      }
    })

    const layer = proj.layers.find((l) => l.id === heroId)!
    expect(layer.fadeIn).toBeGreaterThan(0.1)
    expect(layer.glow?.enabled).toBe(true)
    expect(layer.appliedEffects?.some((f) => f.presetId === 'pulse')).toBe(false)
    expect(layer.appliedEffects?.some((f) => f.presetId === 'neonBreathe')).toBe(true)
  })

  it('Node Light không ghi đè layer.glow khi Layer đang gắn Node FX Glow nguyên tử', () => {
    let { proj, heroId } = makePipelineSample()
    const layerNodeId = v2LayerNodeId(heroId)
    const rGlow = attachLogicNodeToLayerV2(proj.workflow!, layerNodeId, 'fx', 'v2:fx:neonSolid')
    const rLight = attachLogicNodeToLayerV2(rGlow.workflow, layerNodeId, 'light', 'v2:light:rim')

    proj = produce(proj, (d) => {
      d.workflow = rLight.workflow
      const g = d.workflow.nodes.find((n) => n.id === rGlow.createdNodeId)!
      syncWorkflowV2NodeToProject(d as Project, g, { animFxColor: '#ec4899', animFxThickness: 18, intensity: 2.2 })
      const lgt = d.workflow.nodes.find((n) => n.id === rLight.createdNodeId)!
      syncWorkflowV2NodeToProject(d as Project, lgt, { lightColor: '#38bdf8', intensity: 0.7 })
    })

    const layer = proj.layers.find((l) => l.id === heroId)!
    expect(layer.glow?.color).toBe('#ec4899')
    expect(layer.glow?.thickness).toBe(18)
    expect(layer.virtualLight?.enabled).toBe(true)
    expect(layer.virtualLight?.color).toBe('#38bdf8')
  })

  it('xoá Node ở giữa chuỗi Layer -> B1 -> B2 -> B3 tự nối cầu B1 -> B3 và đánh số lại bước', () => {
    let { proj, heroId } = makePipelineSample()
    const layerNodeId = v2LayerNodeId(heroId)
    const r1 = attachLogicNodeToLayerV2(proj.workflow!, layerNodeId, 'action', 'v2:action:drift')
    const r2 = attachLogicNodeToLayerV2(r1.workflow, r1.createdNodeId, 'fx', 'v2:fx:fadeIn')
    const r3 = attachLogicNodeToLayerV2(r2.workflow, r2.createdNodeId, 'fx', 'v2:fx:neonBreathe')

    proj = produce(proj, (d) => {
      d.workflow = r3.workflow
      applyWorkflowV2ToProject(d as Project, d.workflow)
      deleteWorkflowV2Node(d as Project, r2.createdNodeId)
    })

    const wfAfter = proj.workflow!
    expect(wfAfter.nodes.some((n) => n.id === r2.createdNodeId)).toBe(false)
    expect(wfAfter.edges.some((e) => e.fromNode === r1.createdNodeId && e.toNode === r3.createdNodeId)).toBe(true)
    const b3After = wfAfter.nodes.find((n) => n.id === r3.createdNodeId)!
    expect(b3After.params?.pipelineStepIndex).toBe(2)
    expect(b3After.params?.targetLayerIds).toEqual([heroId])
  })
})
