import type { LayerAssemblyTemplate, LayerTemplateSlot } from './layerTemplateTypes'
import { createHumanoidBones, generateIdleBreathe, generateWaveHand } from '../workshopRigPresets'
import { createTemplateComposite } from './templateBuilder'

// Original transparent vector cutouts, in workshop pixels. Colors belong to the artwork.
function artwork(width: number, height: number, body: string, mirror = false): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><g stroke="#24334c" stroke-width="1.5" stroke-linejoin="round" ${mirror ? `transform="translate(${width} 0) scale(-1 1)"` : ''}>${body}</g></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

const head = artwork(64, 76, '<path fill="#edb98b" d="M13 30Q7 26 8 39L13 44Q14 65 32 69Q50 65 51 44Q58 39 54 30L51 28V19H13Z"/><path fill="#33445e" d="M12 32Q3 7 24 5Q55 0 53 32L46 22Q31 26 21 17L15 34Z"/><path d="M20 38h5m14 0h5M27 54q5 4 11 0" fill="none"/><path d="M31 40l-2 7h5" fill="none" stroke="#b87958"/>')
const torso = artwork(80, 104, '<path fill="#edb98b" d="M30 2h20v21H30Z"/><path fill="#397caa" d="M24 15L5 27 13 85 18 101H62L67 85 75 27 56 15 40 29Z"/><path fill="#e7edf3" d="M24 15l16 14-11 12-8-21m35-5L40 29l11 12 8-21"/><path d="M40 29v66M17 66h15m16 0h15" fill="none" stroke="#244f7d"/>')
const pelvis = artwork(70, 40, '<path fill="#33445e" d="M5 3h60l3 32H41l-6-12-6 12H2Z"/><path fill="#8a6747" d="M5 4h60v8H5Z"/><rect x="29" y="3" width="12" height="10" rx="2" fill="#e9c676"/>')
const arm = '<path fill="#397caa" d="M6 9Q16-3 26 9L28 53Q17 65 5 54Z"/><path d="M7 48h19" stroke="#e7edf3"/>'
const forearm = '<path fill="#edb98b" d="M5 8Q14-1 23 8L21 49Q14 59 7 49Z"/>'
const hand = '<path fill="#edb98b" d="M9 3h12l2 12 6 6q2 6-3 5l-4-4v13q-2 7-5 1-2 9-5 1-4 6-5-2L5 21Z"/><path d="M12 25v11m5-11v11" stroke="#b87958"/>'
const leg = '<path fill="#33445e" d="M5 8Q19-3 33 8L29 148H9Z"/><path d="M19 19v115M9 136h20" stroke="#627591" fill="none"/>'
const foot = '<path fill="#27374b" d="M5 4h23v10l18 5q9 4 6 13H4Z"/><path d="M5 29h46M29 17l-9 2m15 2-10 2" stroke="#d5deeb" fill="none"/>'

function slot(id: string, name: string, nameEn: string, cell: number, x: number, y: number, z: number, image: string): LayerTemplateSlot {
  return {
    id, name, nameEn, role: id, atlasCell: cell, boneId: `bone-${id}`,
    defaultTransform: { x, y, z, scale: 1, rotation: 0 },
    suggestedAsset: image, description: name
  }
}

const bones = createHumanoidBones().filter((bone) => !bone.id.includes('shin-')).map((bone) => {
  if (bone.id.includes('thigh-')) return { ...bone, length: 140 }
  if (bone.id.includes('foot-')) return { ...bone, parentId: bone.parentId?.replace('shin-', 'thigh-') }
  return bone
})

export const TMPL_ARTICULATED_13: LayerAssemblyTemplate = {
  id: 'tmpl-character-articulated-13',
  name: 'Nhân vật 13 lớp — Bàn tay & Bàn chân riêng',
  nameEn: '13-Part Character — Separate Hands & Feet',
  category: 'character', ageGroup: 'adult', width: 500, height: 600,
  description: 'Có sẵn ảnh vector trong suốt và 13 xương. Đầu, thân, hông; tay tách 3 đoạn, chân liền và bàn chân riêng. Xoay cổ tay/cổ chân độc lập.',
  descriptionEn: 'Includes 13 transparent vector cutouts and bones. Three-part arms, single-piece legs and separate feet; independent wrists and ankles.',
  slots: [
    slot('head', 'Đầu & Tóc', 'Head with hair', 1, 0, -115, -15, head),
    slot('torso', 'Thân áo', 'Shirt torso', 2, 0, -39, -5, torso),
    slot('pelvis', 'Hông & Thắt lưng', 'Pelvis and belt', 3, 0, 30, -10, pelvis),
    ...(['l', 'r'] as const).flatMap((side, i) => {
      const sign = i === 0 ? -1 : 1, vi = i === 0 ? 'trái' : 'phải', en = i === 0 ? 'Screen-left' : 'Screen-right'
      return [
        slot(`arm-${side}`, `Bắp tay ${vi}`, `${en} upper arm`, 4 + i * 3, sign * 37, -42, -12, artwork(34, 64, arm, i === 0)),
        slot(`forearm-${side}`, `Cẳng tay ${vi}`, `${en} forearm without hand`, 5 + i * 3, sign * 38, 10, -14, artwork(28, 58, forearm, i === 0)),
        slot(`hand-${side}`, `Bàn tay ${vi}`, `${en} hand`, 6 + i * 3, sign * 38, 51, -16, artwork(32, 44, hand, i === 1)),
        slot(`thigh-${side}`, `Chân liền ${vi}`, `${en} whole leg without foot`, 10 + i * 2, sign * 25, 104, 5, artwork(38, 156, leg, i === 0)),
        slot(`foot-${side}`, `Bàn chân ${vi}`, `${en} shoe and foot`, 11 + i * 2, sign * 34, 185, -2, artwork(56, 36, foot, i === 0))
      ]
    })
  ],
  bones,
  clips: [
    { id: 'clip-idle', name: 'Đứng thở', duration: 2.4, loop: true, tracks: generateIdleBreathe(bones, 2.4) },
    { id: 'clip-wave', name: 'Vẫy bàn tay', duration: 1.8, loop: true, tracks: generateWaveHand(bones, 1.8) }
  ],
  activeClipId: 'clip-idle',
  promptGuide: {
    systemPrompt: `Create ONE 16:9 character model sheet, 3840x2160 PNG, opaque flat green #00FF00 background.
Hand-drawn 2D cartoon animation style (like a character design sheet for an animated film):
clean bold outlines, flat cel-shaded colors, no gradients, no cast shadows, no text, no labels, no grid lines.

LAYOUT: split into 2 columns.
- COLUMN 1 (left, ~30% width, x 0–1140): the COMPLETE assembled character, standing, FRONT orthographic view,
  straight relaxed limbs, centered vertically with padding. This is the reference for how the parts fit together.
- COLUMN 2 (right, ~70% width, x 1140–3840): a strict 5 columns x 3 rows grid (15 cells, each 540x720 px),
  numbered 1–15 left-to-right, top-to-bottom. One isolated part per cell.

CHARACTER: adult, blue shirt, dark trousers, dark shoes, belt, short hair.

COLUMN 2 CELL ASSIGNMENTS:
1 head with hair | 2 shirt torso | 3 pelvis and belt | 4 screen-left upper arm | 5 screen-left forearm (no hand)
6 screen-left hand | 7 screen-right upper arm | 8 screen-right forearm (no hand) | 9 screen-right hand | 10 screen-left whole leg (no foot)
11 screen-left shoe and foot | 12 screen-right whole leg (no foot) | 13 screen-right shoe and foot | 14 EMPTY | 15 EMPTY
Empty cells contain only the green background.

RULES:
- Parts in column 2 must be IDENTICAL in design, color and scale to the character in column 1 (same pixel scale, same orthographic front view).
- Do NOT resize parts to fill cells. Keep each part fully inside its cell with padding. Parts must not touch cell edges or each other.
- Left/right follow screen positions, not anatomical.
- Add rounded hidden joint overlaps of 10–15% at shoulder, elbow, wrist, hip, knee, ankle, neck, waist.
- Combined parts stay in ONE cutout. Do not duplicate hands or feet. Keep head and hair together.
- No green in the character itself (avoid green-tinted outlines or highlights).`,
    aspectRatio: '16:9',
    recommendedResolution: '3840x2160',
    cellLayout: [
      'Cột 1 (x 0–1140): Nhân vật hoàn chỉnh (Reference đối chiếu tỉ lệ)',
      '1. Đầu & Tóc (Head with hair)',
      '2. Thân áo (Shirt torso)',
      '3. Hông & Thắt lưng (Pelvis and belt)',
      '4. Bắp tay trái màn hình (Screen-left upper arm)',
      '5. Cẳng tay trái màn hình không bàn tay (Screen-left forearm no hand)',
      '6. Bàn tay trái màn hình (Screen-left hand)',
      '7. Bắp tay phải màn hình (Screen-right upper arm)',
      '8. Cẳng tay phải màn hình không bàn tay (Screen-right forearm no hand)',
      '9. Bàn tay phải màn hình (Screen-right hand)',
      '10. Chân liền trái màn hình không bàn chân (Screen-left whole leg no foot)',
      '11. Bàn chân & Giày trái màn hình (Screen-left shoe and foot)',
      '12. Chân liền phải màn hình không bàn chân (Screen-right whole leg no foot)',
      '13. Bàn chân & Giày phải màn hình (Screen-right shoe and foot)',
      '14. Ô trống (chỉ chứa nền xanh lá)',
      '15. Ô trống (chỉ chứa nền xanh lá)'
    ],
    userGuide: 'Mẫu atlas 16:9 (3840x2160) trên nền xanh lá #00FF00. Cột 1 (30% bên trái) là nhân vật hoàn chỉnh làm chuẩn đối chiếu. Cột 2 (70% bên phải) gồm lưới 5 cột x 3 hàng (15 ô, 13 mảnh + 2 ô trống). Tự động tách ảnh và sinh file rig bằng: python scripts/slice_atlas.py <atlas.png> --out <out_dir>'
  },
  buildComposite: (images, name) => createTemplateComposite(TMPL_ARTICULATED_13, images, name)
}
