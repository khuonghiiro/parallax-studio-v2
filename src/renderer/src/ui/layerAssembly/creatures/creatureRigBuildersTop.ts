import { CreatureRigDraft, legNames, lerp, taperLengths, type AngleLimit } from './creatureRigDraft'
import type { CreatureRigBuild, CreatureRigOptions } from './creatureRigTypes'

/**
 * Khung xương sinh vật NHÌN TỪ TRÊN XUỐNG / CHÍNH DIỆN (đầu hướng lên trên, X = 0 là trục đối xứng):
 * nhện, côn trùng, cua, bạch tuộc, bướm, thằn lằn. Chỉ dựng nửa trái (hậu tố `-l`) rồi phản chiếu sang phải.
 */

type Opts = Required<CreatureRigOptions>

const LEG_LIMITS: Record<number, AngleLimit[]> = {
  2: [[-45, 45], [-70, 70]],
  3: [[-45, 45], [-70, 70], [-50, 50]],
  4: [[-30, 30], [-45, 45], [-70, 70], [-50, 50]]
}

/** Góc các đốt chân toả ra từ thân: a = hướng chân, s = chiều gập (+1 chân trước gập về đầu, −1 chân sau gập về đuôi). */
function radialLegAngles(a: number, s: number, segments: number): number[] {
  if (segments === 2) return [a - 10 * s, a + 30 * s]
  if (segments === 4) return [a - 25 * s, a - 10 * s, a + 20 * s, a + 40 * s]
  return [a - 15 * s, a + 20 * s, a + 40 * s]
}

function radialLegLengths(segments: number, base3: [number, number, number], scale: number): number[] {
  const [a, b, c] = base3
  const raw = segments === 2 ? [a * 1.25, b * 1.2] : segments === 4 ? [a * 0.4, a, b, c] : [a, b, c]
  return raw.map((n) => Number((n * scale).toFixed(2)))
}

interface RadialLegsSpec {
  prefix: string
  parentId: string
  pairs: number
  segments: number
  /** Hướng chân trước & chân sau (độ) với nửa trái. */
  angleFront: number
  angleBack: number
  x: number
  yFront: number
  yBack: number
  base3: [number, number, number]
  /** Pha dáng đi của chân i bên trái. */
  phaseOf: (i: number) => number
  bendOf?: (t: number) => number
}

function addRadialLegs(draft: CreatureRigDraft, spec: RadialLegsSpec): void {
  for (let i = 0; i < spec.pairs; i++) {
    const t = spec.pairs === 1 ? 0.5 : i / (spec.pairs - 1)
    const a = lerp(spec.angleFront, spec.angleBack, t)
    const s = spec.bendOf ? spec.bendOf(t) : t <= 0.5 ? 1 : -1
    const scale = t < 0.2 ? 1.12 : t > 0.8 ? 1.05 : 1
    draft.chain({
      idPrefix: `${spec.prefix}-leg${i + 1}`,
      idSuffix: '-l',
      names: legNames(spec.segments),
      nameSuffix: ` · Chân ${i + 1} Trái`,
      parentId: spec.parentId,
      start: { x: spec.x, y: lerp(spec.yFront, spec.yBack, t) },
      angles: radialLegAngles(a, s, spec.segments),
      lengths: radialLegLengths(spec.segments, spec.base3, scale),
      kind: 'leg',
      side: 'l',
      group: `leg${i + 1}-l`,
      phase: spec.phaseOf(i),
      limits: LEG_LIMITS[spec.segments] ?? LEG_LIMITS[3]
    })
  }
}

/** Dáng bò so le (nhện 4-4, côn trùng tam giác 3-3): chân chẵn/lẻ ngược pha, bên phải lệch nửa chu kỳ. */
const alternatePhase = (i: number) => (i % 2 === 0 ? 0 : 0.5)
const oppositeSide = (role: { phase: number }) => (role.phase + 0.5) % 1

export function buildSpiderRig(o: Opts): CreatureRigBuild {
  const d = new CreatureRigDraft('spider')
  d.add({ id: 'bone-spider-thorax', name: 'Đầu ngực (Root)', x: 0, y: 20, length: 50, angle: -90 }, { kind: 'core', group: 'body' })
  d.add(
    { id: 'bone-spider-head', name: 'Đầu & Mắt', parentId: 'bone-spider-thorax', x: 0, y: -30, length: 20, angle: -90 },
    { kind: 'head', group: 'head' },
    [-30, 30]
  )
  d.add(
    { id: 'bone-spider-abdomen', name: 'Bụng', parentId: 'bone-spider-thorax', x: 0, y: 22, length: 80, angle: 90, strength: 1.4 },
    { kind: 'core', group: 'abdomen' },
    [-35, 35]
  )
  d.chain({
    idPrefix: 'bone-spider-fang', idSuffix: '-l', names: ['Răng nanh'], nameSuffix: ' Trái', parentId: 'bone-spider-head',
    start: { x: 0, y: -50 }, angles: [-112], lengths: [15], kind: 'jaw', side: 'l', group: 'fang-l', limit: [-25, 25]
  })
  d.chain({
    idPrefix: 'bone-spider-palp', idSuffix: '-l', names: ['Xúc biện gốc', 'Xúc biện ngọn'], nameSuffix: ' Trái',
    parentId: 'bone-spider-head', start: { x: -9, y: -44 }, angles: [-140, -110], lengths: [18, 16],
    kind: 'arm', side: 'l', group: 'palp-l', phase: 0.25, limit: [-40, 40]
  })
  addRadialLegs(d, {
    prefix: 'bone-spider', parentId: 'bone-spider-thorax', pairs: o.legPairs, segments: o.legSegments,
    angleFront: -150, angleBack: -210, x: -14, yFront: -26, yBack: 10, base3: [56, 52, 40], phaseOf: alternatePhase
  })
  d.mirrorLeftSide(oppositeSide)
  return d.build()
}

export function buildInsectRig(o: Opts): CreatureRigBuild {
  const d = new CreatureRigDraft('insect')
  d.add({ id: 'bone-insect-thorax', name: 'Ngực (Root)', x: 0, y: 10, length: 30, angle: -90 }, { kind: 'core', group: 'body' })
  d.add(
    { id: 'bone-insect-head', name: 'Đầu', parentId: 'bone-insect-thorax', x: 0, y: -20, length: 24, angle: -90 },
    { kind: 'head', group: 'head' },
    [-35, 35]
  )
  d.chain({
    idPrefix: 'bone-insect-abdomen', names: ['Bụng trước', 'Bụng sau'], parentId: 'bone-insect-thorax',
    start: { x: 0, y: 12 }, angles: [90, 90], lengths: [30, 34], kind: 'core', group: 'abdomen', limit: [-30, 30]
  })
  d.chain({
    idPrefix: 'bone-insect-antenna', idSuffix: '-l', names: ['Râu gốc', 'Râu ngọn'], nameSuffix: ' Trái',
    parentId: 'bone-insect-head', start: { x: 0, y: -44 }, angles: [-120, -150], lengths: [26, 24],
    kind: 'antenna', side: 'l', group: 'antenna-l', limit: [-45, 45]
  })
  if (o.wings) {
    d.chain({
      idPrefix: 'bone-insect-wing', idSuffix: '-l', names: ['Cánh'], nameSuffix: ' Trái', parentId: 'bone-insect-thorax',
      start: { x: -6, y: -12 }, angles: [110], lengths: [60], kind: 'wing', side: 'l', group: 'wing-l', limit: [-80, 80]
    })
  }
  addRadialLegs(d, {
    prefix: 'bone-insect', parentId: 'bone-insect-thorax', pairs: o.legPairs, segments: o.legSegments,
    angleFront: -145, angleBack: -215, x: -10, yFront: -14, yBack: 8, base3: [30, 34, 26], phaseOf: alternatePhase
  })
  d.mirrorLeftSide(oppositeSide)
  return d.build()
}

export function buildCrabRig(o: Opts): CreatureRigBuild {
  const d = new CreatureRigDraft('crab')
  d.add({ id: 'bone-crab-body', name: 'Mai cua (Root)', x: 0, y: 15, length: 30, angle: -90, strength: 1.5 }, { kind: 'core', group: 'body' })
  d.chain({
    idPrefix: 'bone-crab-eye', idSuffix: '-l', names: ['Cuống mắt'], nameSuffix: ' Trái', parentId: 'bone-crab-body',
    start: { x: 0, y: -15 }, angles: [-125], lengths: [20], kind: 'antenna', side: 'l', group: 'eye-l', limit: [-30, 30]
  })
  const claw = d.chain({
    idPrefix: 'bone-crab-claw', idSuffix: '-l', names: ['Cánh càng', 'Cổ càng', 'Càng'], nameSuffix: ' Trái',
    parentId: 'bone-crab-body', start: { x: -22, y: -8 }, angles: [-160, -110, -80], lengths: [30, 26, 26],
    kind: 'arm', side: 'l', group: 'claw-l', phase: 0.25, limits: [[-50, 50], [-70, 70], [-40, 40]]
  })
  const pincerBase = d.bones.find((b) => b.id === claw[2])!
  d.chain({
    idPrefix: 'bone-crab-pincer', idSuffix: '-l', names: ['Ngón càng động'], nameSuffix: ' Trái', parentId: claw[2],
    start: { x: pincerBase.x, y: pincerBase.y }, angles: [-55], lengths: [24], kind: 'jaw', side: 'l', group: 'pincer-l',
    limit: [-10, 35]
  })
  addRadialLegs(d, {
    prefix: 'bone-crab', parentId: 'bone-crab-body', pairs: o.legPairs, segments: o.legSegments,
    angleFront: -165, angleBack: -210, x: -24, yFront: -2, yBack: 16, base3: [28, 30, 22], phaseOf: alternatePhase
  })
  d.mirrorLeftSide(oppositeSide)
  return d.build()
}

export function buildOctopusRig(o: Opts): CreatureRigBuild {
  const d = new CreatureRigDraft('octopus')
  d.add(
    { id: 'bone-octo-head', name: 'Đầu / Áo (Root)', x: 0, y: 10, length: 80, angle: -90, strength: 1.4 },
    { kind: 'core', group: 'body' }
  )
  const pairs = o.legPairs
  for (let i = 0; i < pairs; i++) {
    const t = pairs === 1 ? 1 : i / (pairs - 1)
    const a = lerp(165, 100, t)
    const curl = lerp(10, 4, t)
    d.chain({
      idPrefix: `bone-octo-arm${i + 1}`, idSuffix: '-l',
      names: Array.from({ length: o.chainSegments }, (_, k) => `Đốt ${k + 1}`), nameSuffix: ` · Xúc tu ${i + 1} Trái`,
      parentId: 'bone-octo-head', start: { x: -(10 + 26 * (1 - t)), y: 14 + 6 * t },
      angles: Array.from({ length: o.chainSegments }, (_, k) => a + curl * k),
      lengths: taperLengths(o.chainSegments, 168 / o.chainSegments + 6, 0.84),
      kind: 'tentacle', side: 'l', group: `arm${i + 1}-l`, phase: i * 0.17, limit: [-50, 50], strength: 1.2
    })
  }
  d.mirrorLeftSide((role) => (role.phase + 0.08) % 1)
  return d.build()
}

export function buildButterflyRig(): CreatureRigBuild {
  const d = new CreatureRigDraft('butterfly')
  d.add({ id: 'bone-bfly-thorax', name: 'Ngực (Root)', x: 0, y: 10, length: 22, angle: -90 }, { kind: 'core', group: 'body' })
  d.add(
    { id: 'bone-bfly-head', name: 'Đầu', parentId: 'bone-bfly-thorax', x: 0, y: -12, length: 12, angle: -90 },
    { kind: 'head', group: 'head' },
    [-25, 25]
  )
  d.chain({
    idPrefix: 'bone-bfly-abdomen', names: ['Bụng trước', 'Bụng sau'], parentId: 'bone-bfly-thorax',
    start: { x: 0, y: 12 }, angles: [90, 90], lengths: [26, 26], kind: 'core', group: 'abdomen', limit: [-25, 25]
  })
  d.chain({
    idPrefix: 'bone-bfly-antenna', idSuffix: '-l', names: ['Râu gốc', 'Râu ngọn'], nameSuffix: ' Trái',
    parentId: 'bone-bfly-head', start: { x: 0, y: -24 }, angles: [-110, -125], lengths: [22, 18],
    kind: 'antenna', side: 'l', group: 'antenna-l', limit: [-40, 40]
  })
  d.chain({
    idPrefix: 'bone-bfly-forewing', idSuffix: '-l', names: ['Cánh trước'], nameSuffix: ' Trái', parentId: 'bone-bfly-thorax',
    start: { x: -4, y: -6 }, angles: [-150], lengths: [80], kind: 'wing', side: 'l', group: 'wing-l', limit: [-70, 70], strength: 1.6
  })
  d.chain({
    idPrefix: 'bone-bfly-hindwing', idSuffix: '-l', names: ['Cánh sau'], nameSuffix: ' Trái', parentId: 'bone-bfly-thorax',
    start: { x: -4, y: 6 }, angles: [150], lengths: [60], kind: 'wing', side: 'l', group: 'wing-l', phase: 0.06,
    limit: [-70, 70], strength: 1.5
  })
  d.mirrorLeftSide()
  return d.build()
}

export function buildLizardRig(o: Opts): CreatureRigBuild {
  const d = new CreatureRigDraft('lizard')
  d.add({ id: 'bone-lizard-chest', name: 'Ngực (Root)', x: 0, y: 0, length: 40, angle: -90 }, { kind: 'core', group: 'body' })
  d.add(
    { id: 'bone-lizard-head', name: 'Đầu', parentId: 'bone-lizard-chest', x: 0, y: -40, length: 36, angle: -90 },
    { kind: 'head', group: 'head' },
    [-35, 35]
  )
  d.add(
    { id: 'bone-lizard-pelvis', name: 'Hông', parentId: 'bone-lizard-chest', x: 0, y: 0, length: 40, angle: 90 },
    { kind: 'core', group: 'pelvis' },
    [-25, 25]
  )
  d.chain({
    idPrefix: 'bone-lizard-tail', names: Array.from({ length: o.chainSegments }, (_, k) => `Đuôi ${k + 1}`),
    parentId: 'bone-lizard-pelvis', start: { x: 0, y: 40 }, angles: Array(o.chainSegments).fill(90),
    lengths: taperLengths(o.chainSegments, 150 / o.chainSegments + 10, 0.86), kind: 'tail', group: 'tail', limit: [-35, 35]
  })
  const frontAngles: Record<number, number[]> = { 2: [-165, -120], 3: [-160, -110, -150], 4: [-170, -150, -110, -150] }
  const hindAngles: Record<number, number[]> = { 2: [165, 120], 3: [160, 110, 150], 4: [170, 150, 110, 150] }
  const lens: Record<number, number[]> = { 2: [30, 28], 3: [24, 22, 12], 4: [12, 22, 20, 12] }
  const seg = o.legSegments
  d.chain({
    idPrefix: 'bone-lizard-front', idSuffix: '-l', names: legNames(seg), nameSuffix: ' · Chân trước Trái',
    parentId: 'bone-lizard-chest', start: { x: -8, y: -30 }, angles: frontAngles[seg], lengths: lens[seg],
    kind: 'leg', side: 'l', group: 'front-l', limb: 'front', phase: 0, limits: LEG_LIMITS[seg]
  })
  d.chain({
    idPrefix: 'bone-lizard-hind', idSuffix: '-l', names: legNames(seg), nameSuffix: ' · Chân sau Trái',
    parentId: 'bone-lizard-pelvis', start: { x: -8, y: 34 }, angles: hindAngles[seg], lengths: lens[seg].map((n) => n * 1.1),
    kind: 'leg', side: 'l', group: 'hind-l', limb: 'hind', phase: 0.5, limits: LEG_LIMITS[seg]
  })
  d.mirrorLeftSide(oppositeSide)
  return d.build()
}
