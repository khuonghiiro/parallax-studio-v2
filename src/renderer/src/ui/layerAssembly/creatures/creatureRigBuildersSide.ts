import { CreatureRigDraft, legNames, taperLengths, type AngleLimit } from './creatureRigDraft'
import type { CreatureRigBuild, CreatureRigOptions } from './creatureRigTypes'

/**
 * Khung xương sinh vật NHÌN NGANG (profile), hướng mặt mặc định sang TRÁI (đầu ở phía X âm) giống bộ mẫu cũ;
 * hướng phải được lật bằng `flipCreatureBuild`. Chân gần/xa mang hậu tố `-l`/`-r` để nhận diện cặp đối xứng.
 */

type Opts = Required<CreatureRigOptions>

const range = <T,>(n: number, fn: (i: number) => T): T[] => Array.from({ length: n }, (_, i) => fn(i))

export function buildSnakeRig(o: Opts): CreatureRigBuild {
  const d = new CreatureRigDraft('snake')
  const n = o.chainSegments
  const total = 260
  const weights = range(n, (i) => 1.15 - (0.4 * i) / Math.max(1, n - 1))
  const sum = weights.reduce((a, b) => a + b, 0)
  const lengths = weights.map((w) => Number(((w / sum) * total).toFixed(2)))
  const start = { x: -110, y: 0 }
  d.chain({
    idPrefix: 'bone-snake-body', names: range(n, (i) => (i === 0 ? 'Thân 1 (Root)' : `Thân ${i + 1}`)),
    start, angles: Array(n).fill(0), lengths, kind: 'tail', group: 'spine', limit: [-50, 50], strength: 1.3
  })
  d.roles['bone-snake-body-s1'] = { ...d.roles['bone-snake-body-s1'], kind: 'core' }
  const root = d.bones.find((b) => b.id === 'bone-snake-body-s1')!
  delete root.minAngle
  delete root.maxAngle
  d.add(
    { id: 'bone-snake-head', name: 'Đầu', parentId: 'bone-snake-body-s1', x: start.x, y: start.y, length: 34, angle: 180 },
    { kind: 'head', group: 'head' },
    [-40, 40]
  )
  d.add(
    { id: 'bone-snake-jaw', name: 'Hàm dưới', parentId: 'bone-snake-head', x: start.x, y: start.y + 4, length: 30, angle: 176 },
    { kind: 'jaw', group: 'jaw' },
    [-30, 5]
  )
  return d.build()
}

export function buildFishRig(o: Opts): CreatureRigBuild {
  const d = new CreatureRigDraft('fish')
  d.add({ id: 'bone-fish-root', name: 'Thân trước (Root)', x: -5, y: 0, length: 45, angle: 180, strength: 1.3 }, { kind: 'core', group: 'body' })
  d.add(
    { id: 'bone-fish-head', name: 'Đầu & Mang', parentId: 'bone-fish-root', x: -50, y: 0, length: 40, angle: 180 },
    { kind: 'head', group: 'head' },
    [-20, 20]
  )
  d.add(
    { id: 'bone-fish-jaw', name: 'Hàm / Miệng', parentId: 'bone-fish-head', x: -50, y: 4, length: 40, angle: 174 },
    { kind: 'jaw', group: 'jaw' },
    [-25, 5]
  )
  const spine = d.chain({
    idPrefix: 'bone-fish-spine', names: range(o.chainSegments, (i) => `Cột sống ${i + 1}`), parentId: 'bone-fish-root',
    start: { x: -5, y: 0 }, angles: Array(o.chainSegments).fill(0), lengths: taperLengths(o.chainSegments, 120 / o.chainSegments + 6, 0.86),
    kind: 'tail', group: 'spine', limit: [-35, 35], strength: 1.3
  })
  d.chain({
    idPrefix: 'bone-fish-tailfin', names: ['Vây đuôi'], parentId: spine[spine.length - 1], start: d.tailOf(spine[spine.length - 1]),
    angles: [0], lengths: [42], kind: 'fin', group: 'tailfin', limit: [-45, 45], strength: 1.5
  })
  d.chain({
    idPrefix: 'bone-fish-dorsal', names: ['Vây lưng'], parentId: 'bone-fish-root', start: { x: -10, y: -26 },
    angles: [-35], lengths: [30], kind: 'fin', group: 'dorsal', phase: 0.2, limit: [-30, 30]
  })
  d.chain({
    idPrefix: 'bone-fish-pectoral', idSuffix: '-l', names: ['Vây ngực'], nameSuffix: ' Trái', parentId: 'bone-fish-root',
    start: { x: -40, y: 10 }, angles: [125], lengths: [26], kind: 'fin', side: 'l', group: 'pectoral-l', limit: [-45, 45]
  })
  d.chain({
    idPrefix: 'bone-fish-pectoral', idSuffix: '-r', names: ['Vây ngực'], nameSuffix: ' Phải', parentId: 'bone-fish-root',
    start: { x: -36, y: 6 }, angles: [140], lengths: [22], kind: 'fin', side: 'r', group: 'pectoral-r', phase: 0.5, limit: [-45, 45]
  })
  d.chain({
    idPrefix: 'bone-fish-pelvic', names: ['Vây bụng'], parentId: spine[0], start: { x: 5, y: 18 },
    angles: [120], lengths: [20], kind: 'fin', group: 'pelvic', phase: 0.35, limit: [-35, 35]
  })
  return d.build()
}

export function buildBirdRig(o: Opts): CreatureRigBuild {
  const d = new CreatureRigDraft('bird')
  d.add({ id: 'bone-bird-body', name: 'Thân & Ức (Root)', x: 20, y: 0, length: 50, angle: 180, strength: 1.3 }, { kind: 'core', group: 'body' })
  const neck = d.chain({
    idPrefix: 'bone-bird-neck', names: ['Cổ dưới', 'Cổ trên'], parentId: 'bone-bird-body', start: { x: -30, y: 0 },
    angles: [-115, -95], lengths: [22, 18], kind: 'neck', group: 'neck', limit: [-40, 40]
  })
  d.add(
    { id: 'bone-bird-head', name: 'Đầu', parentId: neck[1], ...d.tailOf(neck[1]), length: 22, angle: 180 },
    { kind: 'head', group: 'head' },
    [-45, 45]
  )
  d.add(
    { id: 'bone-bird-beak', name: 'Mỏ', parentId: 'bone-bird-head', ...d.tailOf('bone-bird-head'), length: 18, angle: 172 },
    { kind: 'jaw', group: 'beak' },
    [-25, 5]
  )
  const wingLimits: AngleLimit[] = [[-90, 60], [-60, 60], [-45, 45]]
  for (const [side, start, suffix] of [['l', { x: -18, y: -10 }, 'Trái'], ['r', { x: -14, y: -14 }, 'Phải']] as const) {
    d.chain({
      idPrefix: 'bone-bird-wing', idSuffix: `-${side}`, names: ['Cánh tay', 'Cẳng cánh', 'Lông bay'], nameSuffix: ` · Cánh ${suffix}`,
      parentId: 'bone-bird-body', start, angles: [-20, 10, 15], lengths: [26, 30, 40], kind: 'wing', side, group: `wing-${side}`,
      limits: wingLimits, strength: 1.4
    })
  }
  d.chain({
    idPrefix: 'bone-bird-tail', names: range(o.chainSegments, (i) => `Lông đuôi ${i + 1}`), parentId: 'bone-bird-body',
    start: { x: 20, y: -2 }, angles: range(o.chainSegments, (i) => -15 + 10 * i),
    lengths: taperLengths(o.chainSegments, 48 / o.chainSegments + 4, 1.1), kind: 'tail', group: 'tail', limit: [-35, 35]
  })
  const legLimits: AngleLimit[] = [[-60, 60], [-90, 30], [-40, 40]]
  for (const [side, start, suffix, phase] of [['l', { x: -2, y: 14 }, 'Trái', 0], ['r', { x: 4, y: 12 }, 'Phải', 0.5]] as const) {
    d.chain({
      idPrefix: 'bone-bird-leg', idSuffix: `-${side}`, names: ['Đùi', 'Cẳng (Giò)', 'Bàn chân'], nameSuffix: ` · Chân ${suffix}`,
      parentId: 'bone-bird-body', start, angles: [110, 70, 180], lengths: [24, 30, 18], kind: 'leg', side, group: `leg-${side}`,
      phase, limits: legLimits
    })
  }
  return d.build()
}

interface QuadrupedConfig {
  species: 'horse' | 'dog' | 'dragon'
  prefix: string
  hips: { x: number; y: number; length: number }
  chestLength: number
  neckAngles: number[]
  neckLengths: number[]
  headAngle: number
  headLength: number
  jaw?: { angle: number; length: number }
  mane?: boolean
  tailStartAngle: number
  tailStep: number
  tailTotal: number
  front: Record<number, { angles: number[]; lengths: number[]; names: string[] }>
  hind: Record<number, { angles: number[]; lengths: number[]; names: string[] }>
  wings?: boolean
}

const QUAD_LIMITS: Record<'front' | 'hind', Record<number, AngleLimit[]>> = {
  front: { 2: [[-60, 60], [-120, 15]], 3: [[-60, 60], [-120, 15], [-60, 30]], 4: [[-40, 40], [-60, 60], [-120, 15], [-60, 30]] },
  hind: { 2: [[-60, 60], [-15, 120]], 3: [[-60, 60], [-15, 120], [-30, 60]], 4: [[-40, 40], [-60, 60], [-15, 120], [-30, 60]] }
}

/** Thú 4 chân nhìn ngang dùng chung: hông (root) → lưng/ngực → cổ → đầu, đuôi, 4 chân (dáng đi bước so le 4 nhịp). */
function buildQuadruped(c: QuadrupedConfig, o: Opts): CreatureRigBuild {
  const d = new CreatureRigDraft(c.species)
  const p = c.prefix
  const hipsTail = { x: c.hips.x - c.hips.length, y: c.hips.y }
  d.add({ id: `${p}-hips`, name: 'Hông (Root)', x: c.hips.x, y: c.hips.y, length: c.hips.length, angle: 180, strength: 1.3 }, { kind: 'core', group: 'body' })
  d.add(
    { id: `${p}-chest`, name: 'Lưng & Ngực', parentId: `${p}-hips`, ...hipsTail, length: c.chestLength, angle: 180, strength: 1.3 },
    { kind: 'core', group: 'body', segment: 1, count: 2 },
    [-15, 15]
  )
  const chestTail = d.tailOf(`${p}-chest`)
  const neck = d.chain({
    idPrefix: `${p}-neck`, names: range(c.neckAngles.length, (i) => `Cổ ${i + 1}`), parentId: `${p}-chest`, start: chestTail,
    angles: c.neckAngles, lengths: c.neckLengths, kind: 'neck', group: 'neck', limit: [-35, 35]
  })
  const neckEnd = neck[neck.length - 1]
  d.add({ id: `${p}-head`, name: 'Đầu', parentId: neckEnd, ...d.tailOf(neckEnd), length: c.headLength, angle: c.headAngle }, { kind: 'head', group: 'head' }, [-40, 40])
  const head = d.bones.find((b) => b.id === `${p}-head`)!
  d.add(
    { id: `${p}-ear`, name: 'Tai', parentId: `${p}-head`, x: head.x + 4, y: head.y - 4, length: 16, angle: -80 },
    { kind: 'ear', group: 'ear', phase: 0.3 },
    [-30, 30]
  )
  if (c.jaw) {
    // Khớp bản lề hàm đặt sát khớp gốc đầu (< 6px) để bộ hàn khớp Moho không kéo lệch xương đầu về phía hàm.
    d.add({ id: `${p}-jaw`, name: 'Hàm dưới', parentId: `${p}-head`, x: head.x, y: head.y + 4, length: c.jaw.length, angle: c.jaw.angle }, { kind: 'jaw', group: 'jaw' }, [-30, 5])
  }
  if (c.mane) {
    d.chain({
      idPrefix: `${p}-mane`, names: ['Bờm gốc', 'Bờm ngọn'], parentId: neck[0], start: { x: chestTail.x + 6, y: chestTail.y - 14 },
      angles: [-120, -108], lengths: [30, 26], kind: 'mane', group: 'mane', phase: 0.15, limit: [-25, 25], strength: 1.2
    })
  }
  if (c.wings) {
    for (const [side, dx, suffix] of [['l', 0, 'Trái'], ['r', 6, 'Phải']] as const) {
      d.chain({
        idPrefix: `${p}-wing`, idSuffix: `-${side}`, names: ['Cánh tay', 'Cẳng cánh', 'Màng cánh'], nameSuffix: ` · Cánh ${suffix}`,
        parentId: `${p}-chest`, start: { x: hipsTail.x - 18 + dx, y: hipsTail.y - 16 - dx }, angles: [-60, -20, 10], lengths: [40, 50, 60],
        kind: 'wing', side, group: `wing-${side}`, limits: [[-80, 60], [-60, 60], [-45, 45]], strength: 1.5
      })
    }
  }
  const n = o.chainSegments
  d.chain({
    idPrefix: `${p}-tail`, names: range(n, (i) => `Đuôi ${i + 1}`), parentId: `${p}-hips`, start: { x: c.hips.x, y: c.hips.y - 4 },
    angles: range(n, (i) => c.tailStartAngle + c.tailStep * i), lengths: taperLengths(n, c.tailTotal / n + 6, 0.88),
    kind: 'tail', group: 'tail', limit: [-45, 45], strength: 1.2
  })
  const seg = o.legSegments
  const legs = [
    { limb: 'front', side: 'l', start: { x: chestTail.x + 8, y: c.hips.y + 14 }, parent: `${p}-chest`, phase: 0.25 },
    { limb: 'front', side: 'r', start: { x: chestTail.x + 16, y: c.hips.y + 12 }, parent: `${p}-chest`, phase: 0.75 },
    { limb: 'hind', side: 'l', start: { x: c.hips.x - 10, y: c.hips.y + 16 }, parent: `${p}-hips`, phase: 0 },
    { limb: 'hind', side: 'r', start: { x: c.hips.x - 2, y: c.hips.y + 14 }, parent: `${p}-hips`, phase: 0.5 }
  ] as const
  for (const leg of legs) {
    const spec = (leg.limb === 'front' ? c.front : c.hind)[seg] ?? (leg.limb === 'front' ? c.front : c.hind)[3]
    d.chain({
      idPrefix: `${p}-${leg.limb}`, idSuffix: `-${leg.side}`, names: spec.names,
      nameSuffix: ` · Chân ${leg.limb === 'front' ? 'trước' : 'sau'} ${leg.side === 'l' ? 'Trái' : 'Phải'}`,
      parentId: leg.parent, start: leg.start, angles: spec.angles, lengths: spec.lengths, kind: 'leg', side: leg.side,
      group: `${leg.limb}-${leg.side}`, limb: leg.limb, phase: leg.phase, limits: QUAD_LIMITS[leg.limb][seg] ?? QUAD_LIMITS[leg.limb][3]
    })
  }
  return d.build()
}

const HOOF_FRONT = {
  2: { angles: [92, 92], lengths: [44, 52], names: ['Chân trên', 'Chân dưới'] },
  3: { angles: [92, 90, 100], lengths: [42, 40, 16], names: ['Cánh tay', 'Ống chân', 'Cổ & Móng'] },
  4: { angles: [70, 95, 90, 105], lengths: [22, 38, 36, 14], names: ['Bả vai', 'Cánh tay', 'Ống chân', 'Móng'] }
}
const HOOF_HIND = {
  2: { angles: [85, 95], lengths: [46, 50], names: ['Đùi', 'Chân dưới'] },
  3: { angles: [80, 100, 95], lengths: [40, 42, 16], names: ['Đùi', 'Khoeo', 'Cổ & Móng'] },
  4: { angles: [70, 110, 88, 100], lengths: [26, 34, 32, 14], names: ['Mông đùi', 'Cẳng', 'Ống chân', 'Móng'] }
}
const PAW_FRONT = {
  2: { angles: [95, 88], lengths: [32, 36], names: ['Chân trên', 'Chân dưới'] },
  3: { angles: [95, 88, 170], lengths: [30, 28, 12], names: ['Cánh tay', 'Cẳng tay', 'Bàn chân'] },
  4: { angles: [70, 98, 88, 170], lengths: [16, 26, 24, 12], names: ['Bả vai', 'Cánh tay', 'Cẳng tay', 'Bàn chân'] }
}
const PAW_HIND = {
  2: { angles: [100, 80], lengths: [34, 36], names: ['Đùi', 'Chân dưới'] },
  3: { angles: [105, 65, 100], lengths: [32, 30, 18], names: ['Đùi', 'Cẳng', 'Bàn chân'] },
  4: { angles: [105, 65, 95, 170], lengths: [30, 26, 16, 10], names: ['Đùi', 'Cẳng', 'Cổ chân', 'Ngón chân'] }
}

export function buildHorseRig(o: Opts): CreatureRigBuild {
  return buildQuadruped(
    {
      species: 'horse', prefix: 'bone-horse', hips: { x: 55, y: -20, length: 50 }, chestLength: 55,
      neckAngles: [-125, -110], neckLengths: [34, 30], headAngle: 125, headLength: 58, mane: true,
      tailStartAngle: 40, tailStep: 20, tailTotal: 84, front: HOOF_FRONT, hind: HOOF_HIND
    },
    o
  )
}

export function buildDogRig(o: Opts): CreatureRigBuild {
  return buildQuadruped(
    {
      species: 'dog', prefix: 'bone-dog', hips: { x: 45, y: -10, length: 42 }, chestLength: 45,
      neckAngles: [-130], neckLengths: [26], headAngle: 170, headLength: 40, jaw: { angle: 166, length: 36 },
      tailStartAngle: -35, tailStep: 10, tailTotal: 68, front: PAW_FRONT, hind: PAW_HIND
    },
    o
  )
}

export function buildDragonRig(o: Opts): CreatureRigBuild {
  return buildQuadruped(
    {
      species: 'dragon', prefix: 'bone-dragon', hips: { x: 50, y: -10, length: 48 }, chestLength: 50,
      neckAngles: [-140, -120, -105], neckLengths: [28, 26, 24], headAngle: 170, headLength: 42,
      jaw: { angle: 166, length: 38 }, wings: true, tailStartAngle: 15, tailStep: 6, tailTotal: 160,
      front: PAW_FRONT, hind: PAW_HIND
    },
    o
  )
}
