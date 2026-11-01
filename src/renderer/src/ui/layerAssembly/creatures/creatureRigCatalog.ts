import type { CreatureClipKind, CreatureRigOptions, CreatureSpecies } from './creatureRigTypes'

export type CreatureView = 'top' | 'side' | 'front'

/** Khoảng tuỳ chỉnh [min, max, mặc định]. */
export type CreatureRange = readonly [number, number, number]

export interface CreatureSpeciesMeta {
  id: CreatureSpecies
  label: string
  icon: string
  hint: string
  view: CreatureView
  legPairs?: CreatureRange
  legPairsLabel?: string
  legSegments?: CreatureRange
  chainSegments?: CreatureRange
  chainLabel?: string
  /** Có tuỳ chọn bật/tắt cánh (giá trị mặc định). */
  wingsOption?: boolean
  clips: CreatureClipKind[]
  /** Từ khoá nhận diện từ tên cụm / tên layer. */
  keywords: RegExp
}

export const CREATURE_SPECIES: CreatureSpeciesMeta[] = [
  {
    id: 'spider',
    label: 'Nhện',
    icon: '🕷️',
    hint: 'Nhìn từ trên: đầu ngực, bụng, răng nanh, xúc biện và 4 cặp chân nhiều đốt (dáng bò so le 4-4)',
    view: 'top',
    legPairs: [1, 6, 4],
    legSegments: [2, 4, 3],
    clips: ['walk', 'idle'],
    keywords: /(spider|tarantula|nhện|nhen)/i
  },
  {
    id: 'insect',
    label: 'Côn trùng',
    icon: '🐜',
    hint: 'Kiến, bọ, ong, gián: đầu, ngực, bụng, râu, 3 cặp chân (dáng bò tam giác) và cánh tuỳ chọn',
    view: 'top',
    legPairs: [1, 4, 3],
    legSegments: [2, 4, 3],
    wingsOption: false,
    clips: ['walk', 'idle', 'flap'],
    keywords: /(insect|\bant\b|beetle|\bbee\b|wasp|cockroach|côn trùng|kiến|bọ rùa|bọ hung|(^|[\s_-])bọ($|[\s_-])|(^|[\s_-])ong($|[\s_-])|gián|châu chấu|dế)/i
  },
  {
    id: 'crab',
    label: 'Cua / Tôm',
    icon: '🦀',
    hint: 'Mai, cuống mắt, 2 càng có ngón kẹp động và 4 cặp chân bò ngang',
    view: 'top',
    legPairs: [2, 5, 4],
    legSegments: [2, 4, 3],
    clips: ['scuttle', 'snap', 'idle'],
    keywords: /(crab|lobster|shrimp|scorpion|cua|ghẹ|tôm|bọ cạp)/i
  },
  {
    id: 'octopus',
    label: 'Bạch tuộc',
    icon: '🐙',
    hint: 'Đầu/áo và các xúc tu nhiều đốt uốn lượn (mực, sứa)',
    view: 'front',
    legPairs: [2, 5, 4],
    legPairsLabel: 'Cặp xúc tu',
    chainSegments: [2, 8, 4],
    chainLabel: 'Đốt xúc tu',
    clips: ['swim', 'idle'],
    keywords: /(octopus|squid|jellyfish|tentacle|bạch tuộc|mực|sứa|xúc tu)/i
  },
  {
    id: 'snake',
    label: 'Rắn / Sâu',
    icon: '🐍',
    hint: 'Chuỗi thân nhiều đốt trườn uốn sóng, đầu và hàm (lươn, giun, sâu)',
    view: 'side',
    chainSegments: [4, 16, 8],
    chainLabel: 'Đốt thân',
    clips: ['slither', 'idle'],
    keywords: /(snake|serpent|worm|eel|caterpillar|rắn|giun|sâu|lươn|trăn)/i
  },
  {
    id: 'fish',
    label: 'Cá',
    icon: '🐟',
    hint: 'Đầu, hàm, cột sống uốn lượn, vây đuôi, vây lưng, vây ngực, vây bụng',
    view: 'side',
    chainSegments: [2, 6, 3],
    chainLabel: 'Đốt sống',
    clips: ['swim', 'idle'],
    keywords: /(fish|koi|shark|dolphin|whale|\bfin\b|cá chép|cá vàng|cá mập|cá heo|vây|(^|[\s_-])cá($|[\s_-]))/i
  },
  {
    id: 'bird',
    label: 'Chim / Gà',
    icon: '🐦',
    hint: 'Thân, cổ 2 đốt, đầu, mỏ, 2 cánh 3 đốt (cánh tay, cẳng, lông bay), đuôi và 2 chân',
    view: 'side',
    chainSegments: [1, 4, 2],
    chainLabel: 'Đốt đuôi',
    clips: ['flap', 'walk', 'idle'],
    keywords: /(bird|chicken|duck|eagle|parrot|wing|beak|chim|gà|vịt|đại bàng|vẹt|cánh|mỏ)/i
  },
  {
    id: 'butterfly',
    label: 'Bướm',
    icon: '🦋',
    hint: 'Nhìn từ trên: thân, đầu, râu, cánh trước và cánh sau mỗi bên (chuồn chuồn, ong bay)',
    view: 'top',
    clips: ['flap', 'idle'],
    keywords: /(butterfly|moth|dragonfly|bướm|ngài|chuồn chuồn)/i
  },
  {
    id: 'horse',
    label: 'Ngựa / Hươu',
    icon: '🐎',
    hint: 'Thú móng guốc nhìn ngang: hông, lưng, cổ, đầu, tai, bờm, đuôi và 4 chân có móng (bò, dê, hươu)',
    view: 'side',
    legSegments: [2, 4, 3],
    chainSegments: [2, 6, 3],
    chainLabel: 'Đốt đuôi',
    clips: ['walk', 'trot', 'idle'],
    keywords: /(horse|pony|deer|cow|goat|camel|hoof|ngựa|hươu|nai|bò|dê|lạc đà|móng)/i
  },
  {
    id: 'dog',
    label: 'Chó / Mèo',
    icon: '🐕',
    hint: 'Thú có đệm chân nhìn ngang: hông, ngực, cổ, đầu, hàm, tai, đuôi nhiều đốt và 4 chân (hổ, sói, cáo)',
    view: 'side',
    legSegments: [2, 4, 3],
    chainSegments: [2, 8, 4],
    chainLabel: 'Đốt đuôi',
    clips: ['walk', 'trot', 'idle'],
    keywords: /(dog|cat|tiger|lion|wolf|fox|puppy|kitten|paw|chó|mèo|hổ|cọp|sư tử|sói|cáo)/i
  },
  {
    id: 'lizard',
    label: 'Thằn lằn',
    icon: '🦎',
    hint: 'Nhìn từ trên: ngực, đầu, hông, đuôi dài nhiều đốt và 4 chân bò ngang (cá sấu, kỳ nhông, rùa)',
    view: 'top',
    legSegments: [2, 4, 3],
    chainSegments: [3, 10, 5],
    chainLabel: 'Đốt đuôi',
    clips: ['walk', 'idle'],
    keywords: /(lizard|gecko|crocodile|alligator|salamander|turtle|thằn lằn|tắc kè|cá sấu|kỳ nhông|rùa)/i
  },
  {
    id: 'dragon',
    label: 'Rồng',
    icon: '🐉',
    hint: 'Thú 4 chân nhìn ngang có cổ dài, hàm, đôi cánh 3 đốt và đuôi dài (khủng long, quái vật)',
    view: 'side',
    legSegments: [2, 4, 3],
    chainSegments: [3, 10, 5],
    chainLabel: 'Đốt đuôi',
    clips: ['walk', 'flap', 'idle'],
    keywords: /(dragon|dinosaur|wyvern|monster|rồng|khủng long|quái vật)/i
  }
]

export function getCreatureMeta(species: CreatureSpecies): CreatureSpeciesMeta {
  return CREATURE_SPECIES.find((m) => m.id === species) ?? CREATURE_SPECIES[0]
}

const clampInt = (value: number | undefined, range: CreatureRange | undefined): number | undefined => {
  if (!range) return undefined
  if (value === undefined || !Number.isFinite(value)) return range[2]
  return Math.max(range[0], Math.min(range[1], Math.round(value)))
}

/** Chuẩn hoá tuỳ chọn theo khoảng hợp lệ của từng loài (MCP/UI dùng chung). */
export function normalizeCreatureOptions(species: CreatureSpecies, options: CreatureRigOptions = {}): Required<CreatureRigOptions> {
  const meta = getCreatureMeta(species)
  return {
    legPairs: clampInt(options.legPairs, meta.legPairs) ?? 0,
    legSegments: clampInt(options.legSegments, meta.legSegments) ?? 3,
    chainSegments: clampInt(options.chainSegments, meta.chainSegments) ?? 0,
    wings: options.wings ?? meta.wingsOption ?? false,
    facing: options.facing === 'right' ? 'right' : 'left'
  }
}

export const CREATURE_CLIP_LABELS: Record<CreatureClipKind, string> = {
  walk: 'Bước đi (Walk)',
  trot: 'Chạy nước kiệu (Trot)',
  idle: 'Thở & chờ (Idle)',
  swim: 'Bơi uốn lượn (Swim)',
  slither: 'Trườn uốn sóng (Slither)',
  flap: 'Vỗ cánh (Flap)',
  scuttle: 'Bò ngang (Scuttle)',
  snap: 'Kẹp càng (Snap)'
}
