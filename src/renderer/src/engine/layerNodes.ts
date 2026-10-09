import * as THREE from 'three'
import type { Layer, ParticleProps } from '@shared/types'
import { mulberry32 } from '../animation/math'
import { LAYER_COMPOSE_FRAG, sharedUniforms, UNIT_PLANE, type AlphaMask } from './renderTypes'
import { LAYER_VERT, PARTICLE_FRAG, PARTICLE_VERT } from './shaders'
import type { ImageMeshDefinition } from '@shared/imageMeshDefinition'
import { evaluateMeshGeometry } from './imageMesh/evaluateDeformation'

export interface LayerNode {
  id: string
  type: Layer['type']
  object: THREE.Mesh | THREE.Points
  /** Props reference the GPU data was built from (immer gives new refs on change). */
  builtFrom: unknown
  planeW: number
  planeH: number
  alpha?: AlphaMask
  /** Texture-pool key (images share one entry per asset). */
  texKey?: string
  resident: boolean
  meshDef?: ImageMeshDefinition
}

export function makeLayerMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: LAYER_VERT,
    fragmentShader: LAYER_COMPOSE_FRAG,
    transparent: true,
    depthWrite: true,
    depthTest: true,
    depthFunc: THREE.LessEqualDepth,
    side: THREE.DoubleSide,
    uniforms: {
      map: { value: null },
      uvRepeat: { value: new THREE.Vector2(1, 1) },
      uvOffset: { value: new THREE.Vector2(0, 0) },
      texSize: { value: new THREE.Vector2(1, 1) },
      planeSize: { value: new THREE.Vector2(1, 1) },
      opacity: { value: 1 },
      multiplyOut: { value: 0 },
      screenOut: { value: 0 },
      glowOn: { value: 0 },
      glowSide: { value: 0 },
      glowColor: { value: new THREE.Color('#3dd6f5') },
      glowRadius: { value: 8 },
      glowIntensity: { value: 1.2 },
      isModel3D: { value: 0 },
      alphaCutoff: { value: 0.25 },
      ...sharedUniforms()
    }
  })
}

export function buildPlaneNode(layer: Layer, scene: THREE.Scene): LayerNode {
  const meshDef = layer.mesh ?? layer.model3d?.mesh
  const geometry = meshDef ? evaluateMeshGeometry(meshDef, { unitSpace: true }) : UNIT_PLANE
  const mesh = new THREE.Mesh(geometry, makeLayerMaterial())
  mesh.frustumCulled = false
  mesh.matrixAutoUpdate = false
  mesh.visible = false
  scene.add(mesh)
  return {
    id: layer.id,
    type: layer.type,
    object: mesh,
    builtFrom: meshDef ? JSON.stringify(meshDef) : null,
    planeW: 1,
    planeH: 1,
    resident: false,
    meshDef
  }
}

export function buildParticles(layer: Layer & { props: ParticleProps }, scene: THREE.Scene): LayerNode {
  const p = layer.props
  const count = Math.max(1, Math.min(20000, Math.round(p.count)))
  const rand = mulberry32(p.seed)
  const pos = new Float32Array(count * 3)
  const rnd = new Float32Array(count * 4)
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (rand() - 0.5) * p.area[0]
    pos[i * 3 + 1] = (rand() - 0.5) * p.area[1]
    pos[i * 3 + 2] = (rand() - 0.5) * p.area[2]
    for (let j = 0; j < 4; j++) rnd[i * 4 + j] = rand()
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aRand', new THREE.BufferAttribute(rnd, 4))
  const mat = new THREE.ShaderMaterial({
    vertexShader: PARTICLE_VERT,
    fragmentShader: PARTICLE_FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    uniforms: {
      time: { value: 0 },
      area: { value: new THREE.Vector3(...p.area) },
      // Velocity is authored in depth space (+z = away); flip z for three.js.
      velocity: { value: new THREE.Vector3(p.velocity[0], p.velocity[1], -p.velocity[2]) },
      sway: { value: p.sway },
      size: { value: p.size },
      pxScale: { value: 1 },
      twinkle: { value: p.twinkle ? 1 : 0 },
      color: { value: new THREE.Color(p.color) },
      opacity: { value: 1 },
      glow: { value: p.glow ? 1 : 0 },
      ...sharedUniforms()
    }
  })
  const points = new THREE.Points(geo, mat)
  points.frustumCulled = false
  points.matrixAutoUpdate = false
  points.visible = false
  scene.add(points)
  return { id: layer.id, type: 'particles', object: points, builtFrom: layer.props, planeW: 1, planeH: 1, resident: true }
}

export function disposeNode(node: LayerNode, scene: THREE.Scene, onDropTexture?: (key: string) => void): void {
  scene.remove(node.object)
  if (node.object.geometry !== UNIT_PLANE) node.object.geometry.dispose()
  ;(node.object.material as THREE.Material).dispose()
  if (node.texKey?.startsWith('cv:') && onDropTexture) onDropTexture(node.texKey)
}
