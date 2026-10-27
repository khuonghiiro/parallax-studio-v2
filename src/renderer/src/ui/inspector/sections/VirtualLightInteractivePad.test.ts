import { describe, expect, it } from 'vitest'
import { computePadFittedBox } from './VirtualLightInteractivePad'

describe('VirtualLightInteractivePad — 1:1 Aspect Ratio Box & UV Transformation', () => {
  it('preserves exact layer aspect ratio and centers the layer box inside the pad stage', () => {
    const stageW = 320
    const stageH = 176
    // Layer cột đèn street-lamp-tree: 420 x 620 (khổ dọc)
    const worldW = 420
    const worldH = 620

    const box = computePadFittedBox(stageW, stageH, worldW, worldH, 0.82)

    // Khung phải được căn giữa hoàn hảo theo cả 2 trục
    const centerX = box.leftNorm + box.wNorm / 2
    const centerY = box.topNorm + box.hNorm / 2
    expect(centerX).toBeCloseTo(0.5, 4)
    expect(centerY).toBeCloseTo(0.5, 4)

    // Tỉ lệ điểm ảnh thực tế (pixel aspect ratio) bên trong stage phải khớp 100% tỉ lệ Three.js mesh
    const pixelBoxW = box.wNorm * stageW
    const pixelBoxH = box.hNorm * stageH
    const calculatedAspect = pixelBoxW / pixelBoxH
    const expectedAspect = worldW / worldH
    expect(calculatedAspect).toBeCloseTo(expectedAspect, 4)

    // Chiều cao phải chạm trần giới hạn lề 82% của stageH
    expect(box.hNorm).toBeCloseTo(0.82, 4)
  })

  it('correctly fits landscape layers (e.g. 1920x1080) without distortion', () => {
    const stageW = 320
    const stageH = 176
    const worldW = 1920
    const worldH = 1080

    const box = computePadFittedBox(stageW, stageH, worldW, worldH, 0.82)

    const centerX = box.leftNorm + box.wNorm / 2
    const centerY = box.topNorm + box.hNorm / 2
    expect(centerX).toBeCloseTo(0.5, 4)
    expect(centerY).toBeCloseTo(0.5, 4)

    const pixelBoxW = box.wNorm * stageW
    const pixelBoxH = box.hNorm * stageH
    expect(pixelBoxW / pixelBoxH).toBeCloseTo(worldW / worldH, 4)

    // Khổ ngang 16:9 trên stage 320x176 (1.81 vs 1.77) sẽ chạm trần chiều rộng hoặc chiều cao tương ứng
    expect(box.wNorm).toBeLessThanOrEqual(0.8201)
    expect(box.hNorm).toBeLessThanOrEqual(0.8201)
  })

  it('guarantees round-trip identity: UV (u, v) -> pad screen coords -> padNormToUV yields exact (u, v)', () => {
    const stageW = 320
    const stageH = 176
    const worldW = 420
    const worldH = 620

    const box = computePadFittedBox(stageW, stageH, worldW, worldH, 0.82)

    const uvToPadPct = (u: number, v: number): [number, number] => {
      const px = (box.leftNorm + u * box.wNorm) * 100
      const py = (box.topNorm + (1 - v) * box.hNorm) * 100
      return [px, py]
    }

    const padNormToUV = (normX: number, normY: number): [number, number] => {
      const u = (normX - box.leftNorm) / box.wNorm
      const v = 1 - (normY - box.topNorm) / box.hNorm
      return [u, v]
    }

    // Kiểm tra toạ độ bóng đèn cột điện (u = 0.726, v = 0.845)
    const testCases: [number, number][] = [
      [0.726, 0.845], // Bóng đèn cột điện
      [0.0, 0.0],     // Góc dưới trái texture
      [1.0, 1.0],     // Góc trên phải texture
      [0.5, 0.5],     // Tâm texture
      [0.25, 0.75]
    ]

    for (const [origU, origV] of testCases) {
      const [padPctX, padPctY] = uvToPadPct(origU, origV)
      const normX = padPctX / 100
      const normY = padPctY / 100
      const [recoveredU, recoveredV] = padNormToUV(normX, normY)

      expect(recoveredU).toBeCloseTo(origU, 4)
      expect(recoveredV).toBeCloseTo(origV, 4)
    }
  })
})
