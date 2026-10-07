import * as THREE from 'three'
import type { LightRigSpec } from './assemblyLighting'

/**
 * three.js light rig of the Assembly viewport: ambient fill + directional sun with soft
 * shadow map, a ground "shadow catcher" under the model and a small sun marker showing
 * where the light comes from.
 */
export interface SceneLightRig {
  group: THREE.Group
  ambient: THREE.AmbientLight
  sun: THREE.DirectionalLight
  ground: THREE.Mesh<THREE.PlaneGeometry, THREE.ShadowMaterial>
  marker: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>
}

export interface RigBounds {
  center: THREE.Vector3
  radius: number
  /** Lowest y of the model (three units): the ground sits there. */
  minY: number
}

const SHADOW_MAP_SIZE = 2048

export function createLightRig(scene: THREE.Scene): SceneLightRig {
  const group = new THREE.Group()
  group.name = 'assembly-light-rig'
  const ambient = new THREE.AmbientLight(0xffffff, Math.PI * 0.8)
  const sun = new THREE.DirectionalLight(0xffffff, Math.PI * 0.3)
  sun.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE)
  sun.shadow.bias = -0.0004
  sun.shadow.radius = 4
  group.add(ambient, sun, sun.target)

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.35, depthWrite: false }))
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  ground.renderOrder = -1
  ground.name = 'assembly-shadow-ground'
  group.add(ground)

  const marker = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }))
  marker.name = 'assembly-sun-marker'
  group.add(marker)
  scene.add(group)
  return { group, ambient, sun, ground, marker }
}

/** Applies a light spec and fits the shadow camera / ground to the model bounds. */
export function applyLightRig(rig: SceneLightRig, spec: LightRigSpec, bounds: RigBounds): void {
  const { ambient, sun, ground, marker } = rig
  const radius = Math.max(100, bounds.radius)
  const dir = new THREE.Vector3(...spec.direction).normalize()

  ambient.color.set(spec.ambientColor)
  ambient.intensity = spec.ambientIntensity
  sun.color.set(spec.sunColor)
  sun.intensity = spec.sunIntensity
  sun.target.position.copy(bounds.center)
  sun.position.copy(bounds.center).addScaledVector(dir, radius * 3)
  sun.castShadow = spec.shadows

  const cam = sun.shadow.camera
  const extent = radius * 1.25
  cam.left = -extent
  cam.right = extent
  cam.top = extent
  cam.bottom = -extent
  cam.near = Math.max(1, radius * 0.5)
  cam.far = radius * 6
  cam.updateProjectionMatrix()
  sun.shadow.normalBias = radius * 0.004
  sun.target.updateMatrixWorld()

  ground.visible = spec.shadows
  ground.material.opacity = spec.shadowOpacity
  ground.position.set(bounds.center.x, bounds.minY - 0.5, bounds.center.z)
  ground.scale.setScalar(radius * 10)

  marker.visible = spec.showSun
  marker.material.color.set(spec.sunColor)
  marker.position.copy(bounds.center).addScaledVector(dir, radius * 2.2)
  marker.scale.setScalar(radius * 0.05)
}

export function disposeLightRig(rig: SceneLightRig): void {
  rig.group.parent?.remove(rig.group)
  rig.sun.shadow.map?.dispose()
  rig.ground.geometry.dispose()
  rig.ground.material.dispose()
  rig.marker.geometry.dispose()
  rig.marker.material.dispose()
}
