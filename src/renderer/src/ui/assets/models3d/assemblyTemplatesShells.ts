import {
  AWAY,
  BACK,
  FRONT,
  LEFT,
  RIGHT,
  UP,
  boxFaces,
  face,
  ridgeSlopes,
  slopePlane,
  type AssemblyTemplate
} from './assemblyTemplateKit'

/**
 * Building SHELLS: walls + roof only. Decoration (windows, doors, chimneys, columns,
 * balconies, plants…) is intentionally left out — build each one from the `decor` templates
 * as its own 3D asset, then merge it onto the shell ("Ghép mô hình" / append_assembly_model).
 * All shells stand on y = -H/2 with the front wall at z = 0.
 */
export const HOUSE_SHELLS: AssemblyTemplate[] = [
  {
    id: 'shell-walls', label: 'Khung tường bao 4 vách', category: 'architecture',
    hint: 'Chỉ 4 vách, chưa có mái – tự ghép mái/trang trí sau',
    en: { label: '4-wall enclosure (no roof)', hint: '4 walls only, no roof – add roof and decor later' },
    faces: () => boxFaces(700, 420, 500, { top: false })
  },
  {
    id: 'shell-two-storey', label: 'Khung nhà 2 tầng mái chữ A', category: 'architecture',
    hint: 'Đầu hồi cao 2 tầng + 2 vách + 2 mái dốc',
    en: { label: 'Two-storey gable shell', hint: 'Two-storey gable ends + 2 side walls + 2 roof slopes' },
    faces: () => {
      const W = 600, H = 640, D = 520, R = 240
      return [
        face('Mặt trước', W, H + R, [0, R / 2, 0], FRONT),
        face('Mặt sau', W, H + R, [0, R / 2, D], BACK),
        face('Vách trái', D, H, [-W / 2, 0, D / 2], LEFT),
        face('Vách phải', D, H, [W / 2, 0, D / 2], RIGHT),
        ...ridgeSlopes(W, R, D, H / 2, 30)
      ]
    }
  },
  {
    id: 'shell-hip-roof', label: 'Khung nhà mái hông 4 dốc', category: 'architecture',
    hint: '4 vách + 4 mái dốc (tẩy góc mái thành hình thang/tam giác)',
    en: { label: 'Hip-roof house shell', hint: '4 walls + 4 roof slopes (erase roof corners into trapezoids/triangles)' },
    faces: () => {
      const W = 700, H = 380, D = 500, R = 200, run = D / 2, top = H / 2
      return [
        ...boxFaces(W, H, D, { top: false }),
        slopePlane('Mái trước', W + 40, [0, top, 0], [0, 0, 1], R, run),
        slopePlane('Mái sau', W + 40, [0, top, D], [0, 0, -1], R, run),
        slopePlane('Mái hông trái', D, [-W / 2, top, D / 2], [1, 0, 0], R, run),
        slopePlane('Mái hông phải', D, [W / 2, top, D / 2], [-1, 0, 0], R, run)
      ]
    }
  },
  {
    id: 'shell-shed-roof', label: 'Khung nhà mái lệch 1 dốc', category: 'architecture',
    hint: 'Vách trước cao, vách sau thấp + 1 mái dốc (dùng "Tự cắt giao nhau" cho vách hông)',
    en: { label: 'Shed-roof house shell', hint: 'Tall front wall, low back wall + one slope (run auto clip on the side walls)' },
    faces: () => {
      const W = 600, D = 450, Hf = 480, Hb = 340, ground = -Hf / 2
      return [
        face('Trước', W, Hf, [0, 0, 0], FRONT),
        face('Sau', W, Hb, [0, ground + Hb / 2, D], BACK),
        face('Trái', D, Hf, [-W / 2, 0, D / 2], LEFT),
        face('Phải', D, Hf, [W / 2, 0, D / 2], RIGHT),
        slopePlane('Mái dốc', W + 40, [0, ground + Hb, D], [0, 0, -1], Hf - Hb, D)
      ]
    }
  },
  {
    id: 'shell-l-house', label: 'Khung nhà chữ L', category: 'architecture',
    hint: 'Cánh chính + cánh nhô ra phía trước, mái bằng',
    en: { label: 'L-shaped house shell', hint: 'Main wing + wing protruding toward the viewer, flat roofs' },
    faces: () => {
      const H = 400, top = H / 2
      return [
        face('Trước cánh chính', 400, H, [-100, 0, 0], FRONT),
        face('Trước cánh nhô', 200, H, [200, 0, -300], FRONT),
        face('Hông cánh nhô', 300, H, [100, 0, -150], LEFT),
        face('Trái', 400, H, [-300, 0, 200], LEFT),
        face('Phải', 700, H, [300, 0, 50], RIGHT),
        face('Sau', 600, H, [0, 0, 400], BACK),
        face('Mái cánh chính', 600, 400, [0, top, 200], UP, AWAY),
        face('Mái cánh nhô', 200, 300, [200, top, -150], UP, AWAY)
      ]
    }
  },
  {
    id: 'shell-townhouse', label: 'Khung nhà ống 3 tầng', category: 'architecture',
    hint: 'Hộp hẹp & cao kiểu nhà phố: mặt tiền + 2 vách + sau + mái',
    en: { label: '3-storey townhouse shell', hint: 'Narrow, tall street-house box: facade + 2 walls + back + roof' },
    faces: () => boxFaces(320, 900, 600)
  },
  {
    id: 'shell-spire-tower', label: 'Khung tháp vuông mái nhọn', category: 'architecture',
    hint: '4 vách tháp + 4 mái nhọn chụm đỉnh (dùng ảnh tam giác)',
    en: { label: 'Square tower with spire', hint: '4 tower walls + 4 spire faces meeting at the top (use triangular images)' },
    faces: () => {
      const W = 300, H = 700, R = 280, run = W / 2, top = H / 2
      return [
        ...boxFaces(W, H, W, { top: false }),
        slopePlane('Mái 1', W, [0, top, 0], [0, 0, 1], R, run),
        slopePlane('Mái 2', W, [W / 2, top, W / 2], [-1, 0, 0], R, run),
        slopePlane('Mái 3', W, [0, top, W], [0, 0, -1], R, run),
        slopePlane('Mái 4', W, [-W / 2, top, W / 2], [1, 0, 0], R, run)
      ]
    }
  }
]
