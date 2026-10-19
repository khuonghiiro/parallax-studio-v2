import { describe, expect, it } from 'vitest'
import { createProject, createShot, createSolidLayer } from '../project/factory'
import { addKeyframe } from '../animation/keyframes'
import { evaluateScene } from './evaluateScene'
import {
  computeLayerColliderAtTime,
  createDefaultLayerPhysics,
  deformVerticesByPhysics,
  evaluateLayerPhysicsTransform,
  triggerLayerPhysicsInteraction
} from './layerPhysics'

describe('layerPhysics — 2.5D Material Physics, Gravity & Combat Impact Simulation', () => {
  it('shakes a wood_tree layer proportionally to punch velocity (light vs heavy punch)', () => {
    const project = createProject({ width: 1920, height: 1080, duration: 10 })
    const tree = createSolidLayer(project.comp)
    tree.name = 'Cây cổ thụ'
    tree.physics = createDefaultLayerPhysics('wood_tree')
    project.layers.push(tree)

    // 1. Light punch at t = 1.0s
    triggerLayerPhysicsInteraction(project, tree.id, 1.0, 'punch_light')
    const lightEval = evaluateLayerPhysicsTransform(project, tree, 1.06, [400, 700])

    // 2. Heavy punch on a second identical tree at t = 1.0s
    const treeHeavy = createSolidLayer(project.comp)
    treeHeavy.name = 'Cây cổ thụ 2'
    treeHeavy.physics = createDefaultLayerPhysics('wood_tree')
    project.layers.push(treeHeavy)
    triggerLayerPhysicsInteraction(project, treeHeavy.id, 1.0, 'punch_heavy')
    const heavyEval = evaluateLayerPhysicsTransform(project, treeHeavy, 1.06, [400, 700])

    expect(lightEval.activeImpactCount).toBe(1)
    expect(heavyEval.activeImpactCount).toBe(1)
    expect(heavyEval.lastImpactSpeed).toBeGreaterThan(lightEval.lastImpactSpeed * 2.5)
    // Heavy punch bends and displaces the tree significantly more than light punch
    expect(Math.abs(heavyEval.rotationDelta[2])).toBeGreaterThan(Math.abs(lightEval.rotationDelta[2]) * 2.0)
    expect(Math.abs(heavyEval.positionDelta[0])).toBeGreaterThan(Math.abs(lightEval.positionDelta[0]) * 2.0)
  })

  it('auto-detects mesh-to-mesh fist collision when a striker character punches a tree', () => {
    const project = createProject({ width: 1920, height: 1080, duration: 10 })
    const shot = createShot('Cảnh Combat', [0, 0, 0], 0)
    project.shots.push(shot)

    const tree = createSolidLayer(project.comp)
    tree.name = 'Thân cây'
    tree.shotId = shot.id
    tree.props.width = 260
    tree.props.height = 600
    tree.transform.position.value = [200, 0, 0]
    tree.physics = createDefaultLayerPhysics('wood_tree')
    project.layers.push(tree)

    const fighter = createSolidLayer(project.comp)
    fighter.name = 'Võ sĩ'
    fighter.shotId = shot.id
    fighter.props.width = 220
    fighter.props.height = 420
    fighter.physics = {
      ...createDefaultLayerPhysics('flesh_body'),
      role: 'striker',
      colliderZone: 'fist_hand'
    }
    // Fighter lunges fast from X = -150 at t = 0.8s into the tree at X = 120 at t = 1.0s (speed ~ 1350 px/s)
    addKeyframe(fighter.transform.position, 0.8, [-150, 0, 0], 'linear')
    addKeyframe(fighter.transform.position, 1.0, [120, 0, 0], 'linear')
    project.layers.push(fighter)

    const fighterCollider = computeLayerColliderAtTime(fighter, 0.95)
    expect(fighterCollider.speed).toBeGreaterThan(500)

    const treeResponse = evaluateLayerPhysicsTransform(project, tree, 1.02, [260, 600])
    expect(treeResponse.activeImpactCount).toBeGreaterThanOrEqual(1)
    expect(Math.abs(treeResponse.rotationDelta[2])).toBeGreaterThan(0.5)
  })

  it('squashes and bounces a jelly_slime layer while keeping its bottom anchored on press', () => {
    const project = createProject({ width: 1920, height: 1080, duration: 10 })
    const jelly = createSolidLayer(project.comp)
    jelly.name = 'Khối thạch Slime'
    jelly.props.width = 300
    jelly.props.height = 300
    jelly.physics = createDefaultLayerPhysics('jelly_slime')
    project.layers.push(jelly)

    triggerLayerPhysicsInteraction(project, jelly.id, 2.0, 'jelly_press')

    // Immediately after press (t = 2.02s): height squashes (scaleY < 1) and width bulges (scaleX > 1)
    const squashed = evaluateLayerPhysicsTransform(project, jelly, 2.02, [300, 300])
    expect(squashed.scaleMultiplier[1]).toBeLessThan(0.88)
    expect(squashed.scaleMultiplier[0]).toBeGreaterThan(1.1)
    expect(squashed.positionDelta[1]).toBeLessThan(-10)

    // Verify evaluateScene integrates the jelly physics transform directly
    const sceneAtPress = evaluateScene(project, 2.02)
    const evalJelly = sceneAtPress.layers.find((l) => l.layer.id === jelly.id)!
    expect(evalJelly.scale[1]).toBeLessThan(evalJelly.scale[0])
  })

  it('simulates character parkour wall-vault parabolic trajectory and transfers hand shock to stone_wall', () => {
    const project = createProject({ width: 1920, height: 1080, duration: 10 })
    const shot = createShot('Cảnh Vượt Tường', [0, 0, 0], 0)
    project.shots.push(shot)

    const wall = createSolidLayer(project.comp)
    wall.name = 'Bờ tường đá'
    wall.shotId = shot.id
    wall.transform.position.value = [100, -120, 0]
    wall.physics = createDefaultLayerPhysics('stone_wall')
    project.layers.push(wall)

    const runner = createSolidLayer(project.comp)
    runner.name = 'Nhân vật Parkour'
    runner.shotId = shot.id
    runner.transform.position.value = [-140, -120, 0]
    runner.physics = createDefaultLayerPhysics('flesh_body')
    project.layers.push(runner)

    triggerLayerPhysicsInteraction(project, runner.id, 1.0, 'wall_vault')

    // Mid-vault (t = 1.42s, near apex of parabolic arc): runner is lifted high above the wall
    const midVault = evaluateLayerPhysicsTransform(project, runner, 1.42, [200, 400])
    expect(midVault.positionDelta[1]).toBeGreaterThan(150)

    // Stone wall also received a synchronized hand-plant impact pulse at t = 1.18s
    expect(wall.physics?.impacts?.length).toBeGreaterThanOrEqual(1)
    const wallShock = evaluateLayerPhysicsTransform(project, wall, 1.21, [400, 300])
    expect(wallShock.activeImpactCount).toBeGreaterThanOrEqual(1)
  })

  it('deforms mesh vertices locally around contactUV (root-pinned tree bend & jelly top indentation)', () => {
    const project = createProject({ width: 1920, height: 1080, duration: 10 })
    const tree = createSolidLayer(project.comp)
    tree.physics = createDefaultLayerPhysics('wood_tree')
    project.layers.push(tree)
    triggerLayerPhysicsInteraction(project, tree.id, 1.0, 'punch_heavy')

    // 3 vertices: bottom root (y = -50), middle trunk (y = 0), top crown (y = +50) in a 100x100 surface
    const positions = new Float32Array([
      0, -50, 0, // root (v = 0)
      0, 0, 0,   // middle (v = 0.5)
      0, 50, 0   // crown (v = 1.0)
    ])
    deformVerticesByPhysics(positions, 100, 100, tree, project, 1.05)

    // Root at v = 0 stays planted (x = 0), while middle and top crown bend horizontally
    expect(Math.abs(positions[0])).toBeCloseTo(0, 4)
    expect(Math.abs(positions[3])).toBeGreaterThan(1.0)
    expect(Math.abs(positions[6])).toBeGreaterThan(Math.abs(positions[3]))
  })
})
