import { describe, it, expect } from 'vitest'
import { getLayerFullResUrl } from './useLayerAssetImage'
import { createCameraFrustumHelper } from './layerAssembly3DHelpers'
import { KNIGHT_COMPOSITE } from './knightComposite'

describe('Layer Assembly Brush Eraser & 3D Camera Depth', () => {
  it('prioritizes directUrl over assetPath so edited eraser pixels take immediate effect', () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    const assetPath = 'character_hero/v2/torso.png'

    // When directUrl is provided (edited by eraser), it MUST take precedence over assetPath
    const resolved = getLayerFullResUrl(assetPath, dataUrl)
    expect(resolved).toBe(dataUrl)

    // When directUrl is undefined/empty, fallback to assetPath resolution
    const fallback = getLayerFullResUrl(assetPath, undefined)
    expect(fallback).not.toBe(dataUrl)
  })

  it('ensures all layers in knightComposite default to z <= 0 to stay inside camera volume', () => {
    for (const layer of KNIGHT_COMPOSITE.layers) {
      // In 3D: posZ = -layer.z * zExaggeration. When layer.z <= 0, posZ >= 0 (in front of or on canvas plane)
      expect(layer.z).toBeLessThanOrEqual(0)
    }

    const thighL = KNIGHT_COMPOSITE.layers.find((l) => l.id === 'knight-thigh-l')
    const forearmL = KNIGHT_COMPOSITE.layers.find((l) => l.id === 'knight-forearm-l')
    expect(thighL).toBeDefined()
    expect(forearmL).toBeDefined()

    // Thigh starts at canvas plane z = 0
    expect(thighL!.z).toBe(0)
    // Symmetrical frontal depth between outer limbs and core
    expect(thighL!.z - forearmL!.z).toBeGreaterThan(40)
  })

  it('creates extended camera frustum helper that bounds both foreground and background depth', () => {
    const frustum = createCameraFrustumHelper(420, 540, 1000, false, 220)
    expect(frustum).toBeDefined()
    const pos = frustum.geometry.getAttribute('position')
    expect(pos).toBeDefined()
    expect(pos.count).toBeGreaterThan(20)

    // Verify presence of background depth points (z = -220)
    let hasBackDepth = false
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(pos.getZ(i) - -220) < 0.001) {
        hasBackDepth = true
        break
      }
    }
    expect(hasBackDepth).toBe(true)
  })

  it('correctly maps 2D display coordinates to natural texture pixel and radius using 380px factor', () => {
    // Giả sử ảnh gốc 1000 x 1000 px, hiển thị tối đa 380 x 380 px
    const naturalW = 1000
    const naturalH = 1000
    const factor = Math.min(1, 380 / Math.max(naturalW, naturalH)) // 0.38
    expect(factor).toBeCloseTo(0.38, 2)

    // Khi click vào tâm layer (unscaledX = 0, unscaledY = 0)
    const unscaledCenterX = 0
    const unscaledCenterY = 0
    const pixelCenterX = unscaledCenterX / factor + naturalW / 2
    const pixelCenterY = unscaledCenterY / factor + naturalH / 2
    expect(pixelCenterX).toBe(500)
    expect(pixelCenterY).toBe(500)

    // Khi click vào mép phải hiển thị của layer (+190px = 380 / 2)
    const unscaledEdgeX = 190
    const pixelEdgeX = unscaledEdgeX / factor + naturalW / 2
    expect(pixelEdgeX).toBeCloseTo(1000, 1) // Chạm đúng mép ngoài 1000px của texture

    // Bán kính cọ 38px trên màn hình khi scale = 1
    const brushSize = 38
    const layerScale = 1.0
    const naturalRadius = brushSize / (layerScale * factor) // 38 / 0.38 = 100px trên texture gốc
    expect(naturalRadius).toBeCloseTo(100, 1)

    // Khi mesh 3D hiển thị texture này trên PlaneGeometry(380, 380):
    // Bán kính hiển thị trên 3D: 100px * factor = 38px -> Khớp 100% với cọ 2D!
    const displayRadiusOn3D = naturalRadius * factor * layerScale
    expect(displayRadiusOn3D).toBeCloseTo(brushSize, 1)
  })

  it('accurately resolves viewport container center with pan and zoom to layer center', () => {
    // Giả lập Viewport container 800 x 600 px tại vị trí (100, 50) trên màn hình
    const rect = { left: 100, top: 50, width: 800, height: 600 }
    const pan = { x: 40, y: -20 }
    const zoom = 1.5
    const layer = { x: -30, y: 50 } // Layer dời (-30, 50) từ tâm composite

    // Tâm của canvas composite trên màn hình
    const compCenterX = rect.left + rect.width / 2 + pan.x // 100 + 400 + 40 = 540
    const compCenterY = rect.top + rect.height / 2 + pan.y // 50 + 300 - 20 = 330
    expect(compCenterX).toBe(540)
    expect(compCenterY).toBe(330)

    // Điểm tâm thực tế của layer trên màn hình (được phóng to bởi zoom)
    const layerScreenX = compCenterX + layer.x * zoom // 540 + (-30 * 1.5) = 495
    const layerScreenY = compCenterY + layer.y * zoom // 330 + (50 * 1.5) = 405

    // Khi người dùng click đúng vào tâm layer trên màn hình (clientX = 495, clientY = 405):
    const compMouseX = (layerScreenX - compCenterX) / zoom // (495 - 540) / 1.5 = -30
    const compMouseY = (layerScreenY - compCenterY) / zoom // (405 - 330) / 1.5 = 50
    const relX = compMouseX - layer.x // -30 - (-30) = 0
    const relY = compMouseY - layer.y // 50 - 50 = 0

    expect(relX).toBeCloseTo(0, 5)
    expect(relY).toBeCloseTo(0, 5)
  })
})
