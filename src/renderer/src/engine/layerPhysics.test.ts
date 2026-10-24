import { describe, expect, it } from 'vitest'
import { createProject, createShot, createSolidLayer } from '../project/factory'
import { addKeyframe } from '../animation/keyframes'
import { evaluateScene } from './evaluateScene'
import {
  createDefaultVirtualLight,
  evaluateVirtualLightAtTime,
  resolveReceivedVirtualLightForLayer
} from './virtualLight'
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

  it('enforces strict Z-depth tolerance and allows a flying arrow projectile to cross Z and stick on hit', () => {
    const project = createProject({ width: 1920, height: 1080, duration: 10 })
    const shot = createShot('Cảnh Bắn Tên Xuyên Z', [0, 0, 0], 0)
    project.shots.push(shot)

    const target = createSolidLayer(project.comp)
    target.name = 'Mục tiêu Gỗ'
    target.shotId = shot.id
    target.props.width = 240
    target.props.height = 500
    target.transform.position.value = [100, 0, 0]
    target.physics = {
      ...createDefaultLayerPhysics('wood_tree'),
      zTolerance: 50
    }
    project.layers.push(target)

    // 1. A regular striker on a far Z layer (Z = 300 > zTolerance 50) does NOT hit the target
    const farStriker = createSolidLayer(project.comp)
    farStriker.name = 'Võ sĩ khác lớp Z'
    farStriker.shotId = shot.id
    farStriker.props.width = 200
    farStriker.props.height = 400
    farStriker.physics = {
      ...createDefaultLayerPhysics('flesh_body'),
      role: 'striker'
    }
    addKeyframe(farStriker.transform.position, 0.5, [-150, 0, 300], 'linear')
    addKeyframe(farStriker.transform.position, 0.7, [120, 0, 300], 'linear')
    project.layers.push(farStriker)

    const noHitEval = evaluateLayerPhysicsTransform(project, target, 0.72, [240, 500])
    expect(noHitEval.activeImpactCount).toBe(0)

    // 2. An arrow projectile flying across Z (from Z = 260 at t = 1.0s to Z = -140 at t = 1.2s)
    // crosses the target's Z = 0 plane at t = 1.13s while overlapping its XY mesh
    const arrow = createSolidLayer(project.comp)
    arrow.name = 'Mũi tên xuyên Z'
    arrow.shotId = shot.id
    arrow.props.width = 90
    arrow.props.height = 24
    arrow.physics = {
      ...createDefaultLayerPhysics('metal_armor'),
      role: 'projectile',
      colliderZone: 'arrow_tip',
      stickOnHit: true,
      zTolerance: 50
    }
    addKeyframe(arrow.transform.position, 1.0, [-120, 10, 260], 'linear')
    addKeyframe(arrow.transform.position, 1.2, [140, 10, -140], 'linear')
    project.layers.push(arrow)

    const hitEval = evaluateLayerPhysicsTransform(project, target, 1.18, [240, 500])
    expect(hitEval.activeImpactCount).toBeGreaterThanOrEqual(1)
    expect(Math.abs(hitEval.rotationDelta[2])).toBeGreaterThan(0.2)

    // Arrow embeds at the impact point (projectileStuck = true) instead of flying past Z = -140
    const arrowAfterHit = evaluateLayerPhysicsTransform(project, arrow, 1.35, [90, 24])
    expect(arrowAfterHit.projectileStuck).toBe(true)
  })

  it('auto-discovers a tagged ground_surface layer on the same Z-plane so falling layers land on its sub-mesh', () => {
    const project = createProject({ width: 1920, height: 1080, duration: 10 })
    const shot = createShot('Cảnh Mặt Đất', [0, 0, 0], 0)
    project.shots.push(shot)

    const ground = createSolidLayer(project.comp)
    ground.name = 'Đế đất rêu'
    ground.shotId = shot.id
    ground.props.width = 1200
    ground.props.height = 200
    ground.transform.position.value = [0, -280, 10]
    ground.physics = {
      ...createDefaultLayerPhysics('ground_terrain'),
      enabled: true,
      role: 'ground_surface',
      meshRegion: { label: 'Mặt đất', minU: 0, maxU: 1, minV: 0.5, maxV: 0.85 }
    }
    project.layers.push(ground)

    const crate = createSolidLayer(project.comp)
    crate.name = 'Thùng gỗ rơi'
    crate.shotId = shot.id
    crate.props.width = 120
    crate.props.height = 120
    crate.transform.position.value = [0, 120, 15] // Within zTolerance of ground (Z=10)
    crate.physics = {
      ...createDefaultLayerPhysics('wood_tree'),
      enabled: true,
      gravityScale: 1.0,
      bounciness: 0.2
    }
    project.layers.push(crate)

    // After 1.5s of gravity, crate settles onto the ground_surface layer instead of falling forever
    const settled = evaluateLayerPhysicsTransform(project, crate, 1.8, [120, 120])
    const finalCenterY = 120 + settled.positionDelta[1]
    const finalBottomY = finalCenterY - 60
    // Ground top is at -280 + (-0.5 + 0.85) * 200 = -210
    expect(finalBottomY).toBeCloseTo(-210, 0)
  })

  it('shrinks and darkens a character entering a Cave Depth Portal, and illuminates them when a Virtual Light is active', () => {
    const project = createProject({ width: 1920, height: 1080, duration: 10 })
    const shot = createShot('Cảnh Hang Động', [0, 0, 0], 0)
    project.shots.push(shot)

    const caveLayer = createSolidLayer(project.comp)
    caveLayer.name = 'Cửa Hang Động'
    caveLayer.shotId = shot.id
    caveLayer.props.width = 800
    caveLayer.props.height = 600
    caveLayer.transform.position.value = [0, 0, 0]
    caveLayer.physics = {
      ...createDefaultLayerPhysics('stone_wall'),
      enabled: true,
      depthPortal: {
        enabled: true,
        centerUV: [0.5, 0.5],
        radiusUV: [0.35, 0.35],
        minScale: 0.35,
        darkness: 0.85,
        depthPullZ: 120,
        shadowTint: '#070913'
      }
    }
    project.layers.push(caveLayer)

    const hero = createSolidLayer(project.comp)
    hero.name = 'Nhân vật thám hiểm'
    hero.shotId = shot.id
    hero.props.width = 180
    hero.props.height = 360
    hero.transform.position.value = [0, 0, 0] // Right at the center of the cave entrance
    hero.physics = createDefaultLayerPhysics('flesh_body')
    project.layers.push(hero)

    // 1. Without any virtual light: character shrinks toward minScale (0.35) and gets darkened by cave shadow
    const darkCaveEval = evaluateLayerPhysicsTransform(project, hero, 1.0, [180, 360])
    expect(darkCaveEval.scaleMultiplier[0]).toBeLessThan(0.5)
    expect(darkCaveEval.positionDelta[2]).toBeGreaterThan(80)
    expect(darkCaveEval.caveDarkness).toBeGreaterThan(0.6)

    // 2. Turn on a Candle Virtual Light inside the cave: character remains shrunken in depth, but darkness is counteracted by the light!
    const candleLayer = createSolidLayer(project.comp)
    candleLayer.name = 'Ngọn nến trong hang'
    candleLayer.shotId = shot.id
    candleLayer.transform.position.value = [20, 10, 20]
    candleLayer.virtualLight = {
      enabled: true,
      kind: 'candle',
      color: '#ff9d3b',
      intensity: 1.6,
      radius: 450,
      zReach: 260,
      coneAngleDeg: 360,
      beamAngleDeg: 0,
      windPreset: 'strong',
      windDirectionDeg: 0,
      flickerSpeed: 2.0,
      windSensitivity: 0.9
    }
    project.layers.push(candleLayer)

    const litCaveEval = evaluateLayerPhysicsTransform(project, hero, 1.0, [180, 360])
    expect(litCaveEval.scaleMultiplier[0]).toBeLessThan(0.5)
    expect(litCaveEval.lightIllumination).toBeGreaterThan(0.4)
    expect(litCaveEval.caveDarkness).toBeLessThan((darkCaveEval.caveDarkness ?? 1) * 0.65)

    // Verify evaluateScene passes caveDarkness, lightIllumination, and wind-swayed candle vlight uniforms
    const scene = evaluateScene(project, 1.15)
    const evalHero = scene.layers.find((l) => l.layer.id === hero.id)!
    const evalCandle = scene.layers.find((l) => l.layer.id === candleLayer.id)!
    expect(evalHero.lightIllumination).toBeGreaterThan(0.4)
    expect(evalCandle.vlightEnabled).toBe(true)
    expect(Math.abs(evalCandle.vlightOffsetUV?.[0] ?? 0)).toBeGreaterThan(0.01) // Strong wind leans the candle flame
  })

  it('reacts to windPreset changes and projects cross-layer 2.5D virtual lights accurately in 3D space', () => {
    const project = createProject({ width: 1920, height: 1080, duration: 10 })
    const shot = createShot('Cảnh Đèn & Gió', [0, 0, 0], 0)
    project.shots.push(shot)

    const candle = createSolidLayer(project.comp)
    candle.shotId = shot.id
    candle.props.width = 200
    candle.props.height = 200
    candle.transform.position.value = [300, 120, 0]
    candle.virtualLight = createDefaultVirtualLight('candle')
    candle.virtualLight.windPreset = 'none'
    const calmEval = evaluateVirtualLightAtTime(candle, 1.25)

    candle.virtualLight.windPreset = 'storm'
    const stormEval = evaluateVirtualLightAtTime(candle, 1.25)
    expect(Math.abs(stormEval!.windOffset[0])).toBeGreaterThan(Math.abs(calmEval!.windOffset[0]) + 5)

    const wall = createSolidLayer(project.comp)
    wall.shotId = shot.id
    wall.props.width = 1000
    wall.props.height = 800
    wall.transform.position.value = [100, 20, -60]
    project.layers.push(candle, wall)

    const received = resolveReceivedVirtualLightForLayer(
      wall.id,
      [100, 20, -60],
      1000,
      800,
      0,
      [calmEval!]
    )
    expect(received).not.toBeNull()
    expect(received!.relU).toBeCloseTo(0.7, 1)
    expect(received!.relV).toBeCloseTo(0.625, 1)
  })
})

