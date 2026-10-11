import { describe, expect, it } from 'vitest'
import {
  createFullHumanoidBones,
  createHandDetailedBones,
  createFootDetailedBones,
  generateHandFistClench,
  generateFootHeelToeRoll
} from './workshopHandFootRig'
import { applyRigAction, validateRig } from './workshopRig'
import { createClipFromPreset } from './workshopRigPresets'
import type { LayerComposite } from './types'

describe('workshopHandFootRig — Humanoid Hand & Foot Armature Templates', () => {
  const baseComp: LayerComposite = {
    id: 'test-hand-foot',
    name: 'Test Hand Foot',
    category: 'character',
    width: 600,
    height: 600,
    layers: []
  }

  it('generates 19-bone full humanoid with separate hand fingers and foot toes', () => {
    const bones = createFullHumanoidBones()
    expect(bones).toHaveLength(19)

    const ids = new Set(bones.map((b) => b.id))
    expect(ids.size).toBe(19)

    // Check finger & toe hierarchy
    expect(bones.find((b) => b.id === 'bone-finger-l')?.parentId).toBe('bone-hand-l')
    expect(bones.find((b) => b.id === 'bone-finger-r')?.parentId).toBe('bone-hand-r')
    expect(bones.find((b) => b.id === 'bone-toe-l')?.parentId).toBe('bone-foot-l')
    expect(bones.find((b) => b.id === 'bone-toe-r')?.parentId).toBe('bone-foot-r')

    // Every parent exists
    for (const b of bones) {
      if (b.parentId) expect(ids.has(b.parentId)).toBe(true)
    }
  })

  it('generates 12-bone detailed hand armature with 5 individual articulated fingers', () => {
    const bones = createHandDetailedBones()
    expect(bones).toHaveLength(12)

    const ids = new Set(bones.map((b) => b.id))
    expect(ids.size).toBe(12)

    // Check finger tips link to finger bases
    for (const finger of ['thumb', 'index', 'middle', 'ring', 'pinky']) {
      const tip = bones.find((b) => b.id === `bone-${finger}-tip`)
      expect(tip?.parentId).toBe(`bone-${finger}-base`)
      const base = bones.find((b) => b.id === `bone-${finger}-base`)
      expect(base?.parentId).toBe('bone-palm')
    }

    expect(bones.find((b) => b.id === 'bone-palm')?.parentId).toBe('bone-wrist')
  })

  it('generates 8-bone detailed leg & foot armature with heel, arch, ball, and toe tip', () => {
    const bones = createFootDetailedBones()
    expect(bones).toHaveLength(8)

    const ids = new Set(bones.map((b) => b.id))
    expect(ids.size).toBe(8)

    expect(bones.find((b) => b.id === 'bone-foot-ankle')?.parentId).toBe('bone-leg-shin')
    expect(bones.find((b) => b.id === 'bone-foot-heel')?.parentId).toBe('bone-foot-ankle')
    expect(bones.find((b) => b.id === 'bone-foot-arch')?.parentId).toBe('bone-foot-ankle')
    expect(bones.find((b) => b.id === 'bone-foot-toe-ball')?.parentId).toBe('bone-foot-arch')
    expect(bones.find((b) => b.id === 'bone-foot-toe-tip')?.parentId).toBe('bone-foot-toe-ball')
  })

  it('generates hand fist clench motion keys across all fingers', () => {
    const bones = createHandDetailedBones()
    const tracks = generateHandFistClench(bones, 2.0)

    expect(Object.keys(tracks).length).toBe(12)
    // Index finger curls
    const indexTipTrack = tracks['bone-index-tip']
    expect(indexTipTrack.length).toBeGreaterThan(2)
    const minRotation = Math.min(...indexTipTrack.map((k) => k.rotation))
    expect(minRotation).toBeLessThan(-50)
  })

  it('generates heel-to-toe rolling step keys with ankle and toe-ball articulation', () => {
    const bones = createFootDetailedBones()
    const tracks = generateFootHeelToeRoll(bones, 2.0)

    expect(Object.keys(tracks).length).toBe(8)
    const ankleTrack = tracks['bone-foot-ankle']
    expect(ankleTrack.length).toBeGreaterThan(2)
    // Ankle flexes up at heel strike and extends on toe-off
    const maxRot = Math.max(...ankleTrack.map((k) => k.rotation))
    const minRot = Math.min(...ankleTrack.map((k) => k.rotation))
    expect(maxRot).toBeGreaterThan(20)
    expect(minRot).toBeLessThan(-15)
  })

  it('applies all new rig templates in workshopRig and produces valid rigs', () => {
    for (const tmpl of ['humanoid', 'humanoid-full', 'hand-detailed', 'foot-detailed', 'simple-chain'] as const) {
      const comp = applyRigAction(baseComp, { action: 'apply-template', template: tmpl })
      expect(() => validateRig(comp)).not.toThrow()
      expect(comp.rig?.bones.length).toBeGreaterThan(2)
      expect(comp.rig?.clips?.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('creates clips from new motion presets hand-clench and foot-roll', () => {
    const handBones = createHandDetailedBones()
    const handClip = createClipFromPreset('hand-clench', handBones)
    expect(handClip.duration).toBe(2.0)
    expect(Object.keys(handClip.tracks).length).toBe(12)

    const footBones = createFootDetailedBones()
    const footClip = createClipFromPreset('foot-roll', footBones)
    expect(footClip.duration).toBe(2.0)
    expect(Object.keys(footClip.tracks).length).toBe(8)
  })
})
