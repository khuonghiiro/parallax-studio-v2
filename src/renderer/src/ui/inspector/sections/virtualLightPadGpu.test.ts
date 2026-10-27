import { describe, expect, it } from 'vitest'
import { createImageLayer, DEFAULT_COMP } from '../../../project/factory'
import { createDefaultVirtualLight, evaluateVirtualLightAtTime, createDefaultDepthPortal } from '../../../engine/virtualLight'
import { makeLayerMaterial } from '../../../engine/layerNodes'
import { makeVolumetricLightMaterial, LAYER_COMPOSE_FRAG } from '../../../engine/renderTypes'
import { VOLUMETRIC_LIGHT_FRAG } from '../../../engine/shaders'
import { evaluatePadLight, syncPadLightMaterials, type VirtualLightPadRenderParams } from './virtualLightPadGpu'

function params(kind: 'candle' | 'flashlight', time: number): VirtualLightPadRenderParams {
  const sourceLayer = createImageLayer({ id: 'test', kind: 'image', mime: 'image/png', name: 'test', width: 600, height: 400 }, DEFAULT_COMP)
  sourceLayer.virtualLight = { ...createDefaultVirtualLight(kind), intensity: 1.35, radius: 460 }
  sourceLayer.transform.scale.value = [0.6, 0.8, 1]
  sourceLayer.transform.rotation.value = [0, 0, 35]
  return { sourceLayer, time, vlight: sourceLayer.virtualLight, isLightEnabled: true,
    portal: createDefaultDepthPortal(), isPortalEnabled: false,
    box: { leftNorm: 0.1, topNorm: 0.1, wNorm: 0.8, hNorm: 0.8 }, worldW: 600, worldH: 400 }
}

describe('light pad camera parity', () => {
  it.each(['candle', 'flashlight'] as const)('%s uses camera intensity, radius and flicker at the playhead', (kind) => {
    for (const t of [0, 5, 7.2, 10.5]) {
      const p = params(kind, t)
      const cameraLight = evaluateVirtualLightAtTime(p.sourceLayer!, t, [0, 0, 0], [600, 400])!
      const result = evaluatePadLight(p)!
      expect(result.light).toEqual(cameraLight)
      expect(result.radius).toBeCloseTo(cameraLight.effectiveRadius / 0.6)
      const surface = makeLayerMaterial()
      const beam = makeVolumetricLightMaterial()
      syncPadLightMaterials(surface, beam, p)
      expect(surface.fragmentShader).toBe(LAYER_COMPOSE_FRAG)
      expect(beam.fragmentShader).toBe(VOLUMETRIC_LIGHT_FRAG)
      expect(surface.uniforms.vlightParams.value.x).toBe(cameraLight.effectiveIntensity)
      expect(surface.uniforms.vlightParams.value.y).toBe(result.radius)
      expect(beam.uniforms.vlightParams.value).toEqual(surface.uniforms.vlightParams.value)
      surface.dispose(); beam.dispose()
    }
  })
  it('disables the source instead of retaining a stale glow', () => {
    const p = params('candle', 5)
    p.isLightEnabled = false
    expect(evaluatePadLight(p)).toBeNull()
  })
})
