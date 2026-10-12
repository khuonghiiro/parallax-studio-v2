import { TMPL_ARTICULATED_13 } from './articulatedCharacter'
import { createTemplateComposite } from './templateBuilder'
import type { LayerAssemblyTemplate, LayerTemplateSlot } from './layerTemplateTypes'
import { createHumanoidBones, generateIdleBreathe, generateWalkCycle, generateWaveHand } from '../workshopRigPresets'

function legSegment(shin: boolean): string {
  const path = shin ? 'M5 9Q17-3 29 9L27 74Q17 86 7 74Z' : 'M3 10Q17-4 31 10L29 74Q17 86 5 74Z'
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="34" height="84" viewBox="0 0 34 84"><path d="${path}" fill="#33445e" stroke="#24334c" stroke-width="1.5"/><path d="M17 18v48" fill="none" stroke="#627591"/></svg>`)}`
}

function puppetSlots(): LayerTemplateSlot[] {
  const upper = TMPL_ARTICULATED_13.slots.filter((slot) => !/^(thigh|foot)-/.test(slot.id))
  const legs = (['l', 'r'] as const).flatMap((side, i) => {
    const vi = i === 0 ? 'trái' : 'phải', en = i === 0 ? 'Screen-left' : 'Screen-right'
    const sign = i === 0 ? -1 : 1
    return [
      { id: `thigh-${side}`, name: `Đùi ${vi}`, nameEn: `${en} thigh`, role: `thigh-${side}`,
        atlasCell: 10 + i * 3, boneId: `bone-thigh-${side}`,
        defaultTransform: { x: sign * 25, y: 70, z: 5, scale: 1, rotation: 0 },
        suggestedAsset: legSegment(false), description: 'Từ hông đến gối, không kèm cẳng chân' },
      { id: `shin-${side}`, name: `Cẳng chân ${vi}`, nameEn: `${en} shin without foot`, role: `shin-${side}`,
        atlasCell: 11 + i * 3, boneId: `bone-shin-${side}`,
        defaultTransform: { x: sign * 25, y: 140, z: 3, scale: 1, rotation: 0 },
        suggestedAsset: legSegment(true), description: 'Từ gối đến cổ chân, không kèm bàn chân' },
      { ...TMPL_ARTICULATED_13.slots.find((slot) => slot.id === `foot-${side}`)!, atlasCell: 12 + i * 3 }
    ]
  })
  return [...upper, ...legs].sort((a, b) => a.atlasCell! - b.atlasCell!)
}

const bones = createHumanoidBones()

export const TMPL_PUPPET_15: LayerAssemblyTemplate = {
  ...TMPL_ARTICULATED_13,
  id: 'tmpl-character-puppet-15',
  name: 'Búp bê 15 lớp — Tách đủ khớp tay & chân',
  nameEn: '15-Part Puppet — Fully Segmented Arms & Legs',
  description: 'Đầu, thân, hông và mỗi tay/chân tách 3 đoạn. Có sẵn 15 ảnh vector, 15 xương, gập gối và xoay khuỷu tay, cổ tay, cổ chân độc lập.',
  descriptionEn: 'Adult cartoon in a blue shirt, dark trousers and shoes. Head, torso, pelvis and three separate segments per arm and leg, with 15 illustrated parts and bones.',
  slots: puppetSlots(), bones,
  clips: [
    { id: 'clip-idle', name: 'Đứng thở', duration: 2.4, loop: true, tracks: generateIdleBreathe(bones, 2.4) },
    { id: 'clip-walk', name: 'Bước đi gập gối', duration: 1.6, loop: true, tracks: generateWalkCycle(bones, 1.6) },
    { id: 'clip-wave', name: 'Vẫy bàn tay', duration: 1.8, loop: true, tracks: generateWaveHand(bones, 1.8) }
  ],
  promptGuide: {
    systemPrompt: 'IDENTITY: Adult hand-drawn cartoon, blue shirt, dark trousers, dark shoes, belt, short hair. Clean outlines and flat cel shading.',
    cellLayout: [], userGuide: ''
  },
  buildComposite: (images, name) => createTemplateComposite(TMPL_PUPPET_15, images, name)
}
