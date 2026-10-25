import { describe, expect, it } from 'vitest'
import { CUTOUT_HERO_COMPOSITE } from './cutoutHeroComposite'
import {
  autoSortLayersZDepth25D,
  buildAnatomicalBonesFromLayers,
  detectCompositeRigArchetype,
  smartAutoBindCompositeLayers
} from './workshopSmartRig25D'
import {
  applyLayerParallax25DOffset,
  computeParallax25DPose,
  createParallax25DClip,
  generateParameterizedCycle25D
} from './workshopParallax25D'
import { applyLayerMotionHarmony } from './workshopLayerMotionHarmony'
import { computeLayerMotion } from './layerAssemblyMotion'
import { applyRigAction } from './workshopRig'
import { simulateSecondary, DEFAULT_SECONDARY } from './workshopSecondaryMotion'

describe('workshopSmartRig25D & workshopParallax25D & workshopLayerMotionHarmony', () => {
  it('detects humanoid archetype on 13-part anime character composite and builds anatomical bones + accessory bones', () => {
    const composite = structuredClone(CUTOUT_HERO_COMPOSITE)
    composite.layers.push({
      id: 'demo-cape',
      name: 'cape-back',
      x: 0,
      y: -30,
      z: 45,
      scale: 1,
      rotation: 0,
      opacity: 1,
      motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'top' }
    })

    expect(detectCompositeRigArchetype(composite)).toBe('humanoid')
    const built = buildAnatomicalBonesFromLayers(composite, 'auto')
    expect(built.resolvedArchetype).toBe('humanoid')
    expect(built.bones.some((b) => b.id === 'bone-pelvis')).toBe(true)
    expect(built.bones.some((b) => b.id === 'bone-head')).toBe(true)
    expect(built.bones.some((b) => b.id === 'bone-cape')).toBe(true)
    expect(built.clips.length).toBeGreaterThanOrEqual(5)
  })

  it('auto-binds all layers to matching anatomical bones and sorts 2.5D Z-depth planes', () => {
    const composite = structuredClone(CUTOUT_HERO_COMPOSITE)
    const unbound = composite.layers.map((l) => ({ ...l, boneId: undefined, z: 0 }))
    const bound = smartAutoBindCompositeLayers(unbound, composite.rig!.bones, 'auto')

    const headLayer = bound.find((l) => l.name === 'head')
    const glassesLayer = bound.find((l) => l.name === 'glasses')
    const armLLayer = bound.find((l) => l.name === 'arm-left')
    const shinRLayer = bound.find((l) => l.name === 'shin-right')

    expect(headLayer?.boneId).toBe('bone-head')
    expect(glassesLayer?.boneId).toBe('bone-head')
    expect(armLLayer?.boneId).toBe('bone-arm-l')
    expect(shinRLayer?.boneId).toBe('bone-shin-r')

    const zSorted = autoSortLayersZDepth25D(bound)
    const zGlasses = zSorted.find((l) => l.name === 'glasses')!.z
    const zFace = zSorted.find((l) => l.name === 'face-normal')!.z
    const zHead = zSorted.find((l) => l.name === 'head')!.z
    const zTorso = zSorted.find((l) => l.name === 'torso')!.z
    const zThigh = zSorted.find((l) => l.name === 'thigh-left')!.z

    expect(zGlasses).toBeLessThan(zFace)
    expect(zFace).toBeLessThan(zHead)
    expect(zHead).toBeLessThan(zTorso)
    expect(zTorso).toBeLessThan(zThigh)
  })

  it('computes Live2D/Spine 2.5D parallax pose and generates 2.5D parallax clips via applyRigAction', () => {
    const composite = structuredClone(CUTOUT_HERO_COMPOSITE)
    const bones = composite.rig!.bones
    const poses = computeParallax25DPose(bones, 0.8, -0.4, 1.0)
    const headPose = poses.find((p) => p.boneId === 'bone-head')!
    const torsoPose = poses.find((p) => p.boneId === 'bone-torso')!

    expect(headPose.x ?? 0).toBeGreaterThan(torsoPose.x ?? 0)
    expect(headPose.scaleX).toBeLessThan(1)

    const tiltedLayers = applyLayerParallax25DOffset(composite.layers, 0.8, -0.4, 1.0)
    expect(tiltedLayers.find((l) => l.name === 'glasses')?.rotationY).toBeGreaterThan(0)

    const afterPose = applyRigAction(composite, {
      action: 'apply-parallax-25d-pose',
      time: 0.4,
      yawX: 0.7,
      pitchY: -0.3,
      intensity: 1.0,
      applyLayerTilt: true
    })
    expect(afterPose.rig?.tracks['bone-head']?.some((k) => Math.abs(k.time - 0.4) < 0.01)).toBe(true)

    const afterClip = applyRigAction(composite, {
      action: 'add-parallax-25d-clip',
      preset: 'look-around-25d',
      intensity: 1.2
    })
    expect(afterClip.rig?.activeClipId).toContain('clip-25d-look-around-25d')
    expect(createParallax25DClip('hero-wind-idle-25d', bones, 1.0).tracks['bone-head'].length).toBeGreaterThan(10)
  })

  it('synthesizes Duik-style parameterized 2.5D cycles and simulates Wind + Gravity on secondary bones', () => {
    const composite = structuredClone(CUTOUT_HERO_COMPOSITE)
    const cycleClip = generateParameterizedCycle25D(composite.rig!.bones, {
      cycleType: 'sneak',
      stride: 0.8,
      bounce: 0.6,
      armSwing: 0.5,
      bodyLean: 12,
      depth25D: 1.2,
      viewAngle: 'diagonal'
    })
    expect(cycleClip.tracks['bone-thigh-l'].length).toBeGreaterThan(10)
    expect(cycleClip.viewAngle).toBe('diagonal')

    // Simulate secondary motion with windSpeed > 0 even on a static rig
    const staticRig = { ...composite.rig!, tracks: {} }
    const sim = simulateSecondary(staticRig, ['bone-head'], {
      ...DEFAULT_SECONDARY,
      windSpeed: 1.2,
      windTurbulence: 0.6,
      gravity: 0.2
    })
    const headOffsets = sim.get('bone-head') ?? []
    expect(headOffsets.some((angle) => Math.abs(angle) > 0.5)).toBe(true)
  })

  it('computes wave layer motion and applies 2.5D Layer Motion Harmony across layers', () => {
    const wave = computeLayerMotion(
      { type: 'wave', speed: 1, amplitude: 8, anchor: 'top', phaseOffset: 0 },
      0.25
    )
    expect(Math.abs(wave.animRotateDeg) + Math.abs(wave.animTranslateX)).toBeGreaterThan(0)

    const composite = structuredClone(CUTOUT_HERO_COMPOSITE)
    const breathed = applyLayerMotionHarmony(composite, {
      preset: 'anatomy-breathe',
      speedMultiplier: 1.0,
      amplitudeMultiplier: 1.0,
      staggerPhase: true
    })
    const torso = breathed.layers.find((l) => l.name === 'torso')!
    const head = breathed.layers.find((l) => l.name === 'head')!
    const shin = breathed.layers.find((l) => l.name === 'shin-left')!

    expect(torso.motion.type).toBe('breathe')
    expect(head.motion.type).toBe('float')
    expect(shin.motion.type).toBe('none')
  })
})
