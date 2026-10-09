import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import {
  create3DBonesGroup,
  update3DBonesGroup,
  dispose3DBonesGroup
} from './layerAssembly3DBones'
import { createHumanoidBones } from './workshopRigPresets'
import { evaluateRig } from '../../engine/layerRig'
import type { LayerRig } from '@shared/layerRig'

describe('layerAssembly3DBones', () => {
  it('creates, updates and disposes 3D bones group', () => {
    const group = create3DBonesGroup()
    expect(group).toBeDefined()
    expect(group.name).toBe('skeleton-3d-root')

    const bones = createHumanoidBones()
    const rig: LayerRig = {
      bones,
      duration: 2.0,
      loop: true,
      tracks: {}
    }
    const transforms = evaluateRig(rig, 0)

    const layers = [
      {
        id: 'l-pelvis',
        name: 'Hông',
        assetPath: 'test.png',
        boneId: 'bone-pelvis',
        x: 0,
        y: 30,
        z: 0,
        scale: 1,
        rotation: 0,
        opacity: 1,
        motion: { type: 'none' as const, speed: 1, amplitude: 0, anchor: 'center' as const }
      }
    ]

    update3DBonesGroup({
      group,
      rig,
      transforms,
      layers,
      selectedBoneId: 'bone-pelvis',
      zExaggeration: 1.8,
      visible: true
    })

    expect(group.visible).toBe(true)
    // 11 bones * (head mesh + tail mesh + bone wireframe) = at least 33 children
    expect(group.children.length).toBeGreaterThan(20)

    // Hidden state
    update3DBonesGroup({
      group,
      rig,
      transforms,
      layers,
      selectedBoneId: null,
      zExaggeration: 1.8,
      visible: false
    })
    expect(group.visible).toBe(false)

    dispose3DBonesGroup(group)
    expect(group.children.length).toBe(0)
  })
})
