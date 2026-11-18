import { describe, expect, it } from 'vitest'
import { createImageLayer, createProject, createShot } from '../../../project/factory'
import { resolveWorkflowV2 } from '../../../project/workflowV2Engine'
import {
  alignEntityOnStageInDraft,
  flipEntityHorizontalInDraft,
  placeBbox2TargetAtWorldXYInDraft,
  resolveShotCameraRouteNodes,
  stepEntityDepthZInDraft,
  syncCamera3DToEntityOrMotionInDraft
} from './nodeStageQuickActions'

describe('nodeStageQuickActions', () => {
  it('flips a locked 2.5D cluster horizontally around its root without breaking part offsets', () => {
    const project = createProject()
    const shot = createShot('Cảnh 1')
    project.shots.push(shot)

    const rootLayer = createImageLayer(
      { id: 'a1', name: 'Thân', kind: 'image', mime: 'image/png', width: 280, height: 420 },
      project.comp,
      0,
      shot.id
    )
    rootLayer.id = 'boy-root'
    rootLayer.transform.position.value = [-200, -50, 100]
    rootLayer.composite = {
      instanceId: 'inst-boy',
      compositeId: 'comp-boy',
      compositeName: 'Cậu Bé',
      isRoot: true,
      lockedGroup: true,
      rootOffset: [0, 0, 0]
    }

    const armLayer = createImageLayer(
      { id: 'a2', name: 'Tay phải', kind: 'image', mime: 'image/png', width: 90, height: 180 },
      project.comp,
      1,
      shot.id
    )
    armLayer.id = 'boy-arm'
    armLayer.transform.position.value = [-160, -30, 98]
    armLayer.transform.rotation.value = [0, 0, 15]
    armLayer.composite = {
      instanceId: 'inst-boy',
      compositeId: 'comp-boy',
      compositeName: 'Cậu Bé',
      isRoot: false,
      lockedGroup: true,
      rootOffset: [40, 20, -2]
    }

    project.layers.push(rootLayer, armLayer)

    const ok = flipEntityHorizontalInDraft(project, 'boy-root', true)
    expect(ok).toBe(true)
    const root = project.layers.find((l) => l.id === 'boy-root')!
    const arm = project.layers.find((l) => l.id === 'boy-arm')!
    expect(root.transform.scale.value[0]).toBe(-1)
    expect(arm.transform.scale.value[0]).toBe(-1)
    expect(arm.transform.position.value[0]).toBe(-240)
    expect(arm.composite?.rootOffset?.[0]).toBe(-40)
    expect(arm.transform.rotation.value[2]).toBe(-15)
  })

  it('aligns entity on stage and steps Z depth cleanly', () => {
    const project = createProject()
    const shot = createShot('Cảnh 1')
    project.shots.push(shot)

    const prop = createImageLayer(
      { id: 'tree', name: 'Cây Sồi', kind: 'image', mime: 'image/png', width: 420, height: 540 },
      project.comp,
      0,
      shot.id
    )
    prop.id = 'prop-1'
    prop.transform.position.value = [320, 140, 200]
    project.layers.push(prop)

    expect(alignEntityOnStageInDraft(project, 'prop-1', 'center', false)).toBe(true)
    expect(project.layers.find((l) => l.id === 'prop-1')!.transform.position.value).toEqual([0, 0, 200])

    expect(alignEntityOnStageInDraft(project, 'prop-1', 'ground', false)).toBe(true)
    expect(project.layers.find((l) => l.id === 'prop-1')!.transform.position.value[1]).toBeLessThan(-150)

    const nextZ = stepEntityDepthZInDraft(project, 'prop-1', -80, false)
    expect(nextZ).toBe(120)
    expect(project.layers.find((l) => l.id === 'prop-1')!.transform.position.value[2]).toBe(120)
  })

  it('spawns BBox #2 at exact cursor world coordinates and syncs 3D camera tracking', () => {
    const project = createProject()
    const shot = createShot('Cảnh 1')
    project.shots.push(shot)

    const hero = createImageLayer(
      { id: 'hero', name: 'Nhân Vật', kind: 'image', mime: 'image/png', width: 320, height: 480 },
      project.comp,
      0,
      shot.id
    )
    hero.id = 'hero-1'
    hero.transform.position.value = [-300, -100, 0]
    project.layers.push(hero)

    const wf = resolveWorkflowV2(project)
    project.workflow = wf
    const layer = project.layers.find((l) => l.id === 'hero-1')!

    const placed = placeBbox2TargetAtWorldXYInDraft(project, {
      workflow: wf,
      activeNode: null,
      attachTargetNodeId: 'v2-layer-hero-1',
      layer,
      worldX: 260,
      worldY: -80,
      currentTime: 0.4
    })
    expect(placed).not.toBeNull()
    const createdMotion = project.workflow!.nodes.find((n) => n.id === placed!.nodeId)!
    expect(createdMotion.params?.bboxTargetX).toBe(260)
    expect(createdMotion.params?.bboxTargetY).toBe(-80)

    const camSync = syncCamera3DToEntityOrMotionInDraft(project, {
      node: createdMotion,
      layer,
      useCluster: false,
      atTime: 0.4
    })
    expect(camSync?.followedMotion).toBe(true)
    expect(project.camera.position.keyframes.length).toBeGreaterThanOrEqual(2)

    const camRoute = resolveShotCameraRouteNodes(project, project.workflow!, createdMotion, layer, shot.id)
    expect(camRoute.shotId).toBe(shot.id)
    expect(camRoute.entryCameraNode).not.toBeNull()
  })
})
