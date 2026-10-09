import type {
  AttachmentBand,
  BackSidePolicy,
  SilhouettePolicy,
  MaterialGroup
} from '@shared/imageMeshContract'

/** Image symmetry concerns the flat artwork, not the orientation of repeated faces. */
const bilateral = {
  en: 'Keep the silhouette approximately left/right symmetric about x=50%; small natural texture differences are allowed. Do not mirror top to bottom.',
  vi: 'Đường viền gần đối xứng trái/phải qua x=50%; cho phép chi tiết tự nhiên khác nhau nhẹ. Không đối xứng trên/dưới.'
}
const rectangular = {
  en: 'Keep the rectangular boundary exact; the material need not be mirror symmetric. Match opposite edge colors for repeated walls.',
  vi: 'Giữ biên chữ nhật chính xác; vật liệu không cần đối xứng gương. Khớp màu hai mép đối diện khi ảnh lặp trên các vách.'
}
const organic = {
  en: 'No mirror symmetry required; keep natural variation and the specified alignment.',
  vi: 'Không bắt buộc đối xứng gương; giữ biến thiên tự nhiên và vị trí đã quy định.'
}
const elevation = {
  en: 'Use a regular facade grid, approximately left/right symmetric; do not mirror top to bottom. Place the 12 floor bands at the same normalized image heights as the other elevation, with boundaries at y=k/12 (k=0..12, measured from the top). Keep opaque windows and matching wall colors at the corners.',
  vi: 'Lưới mặt đứng đều, gần đối xứng trái/phải; không lật trên/dưới. Chia 12 dải tầng có biên y=k/12 (k=0..12, tính từ đỉnh ảnh), khớp mặt đứng còn lại. Cửa sổ phải đục, màu tường khớp tại góc.'
}

export interface SlotRuleDefinition {
  alphaMode: 'cutout' | 'opaque'
  symmetry: { en: string; vi: string }
  anchorUV: [number, number]
  tipUV?: [number, number]
  attachmentBand?: AttachmentBand
  silhouettePolicy: SilhouettePolicy
  backPolicy: BackSidePolicy
  materialGroup: MaterialGroup
}

export const IMAGE_MESH_SLOT_RULES: Record<string, SlotRuleDefinition> = {
  leaf: {
    alphaMode: 'cutout',
    symmetry: bilateral,
    anchorUV: [0.5, 0.0],
    tipUV: [0.5, 1.0],
    attachmentBand: { vMin: 0.0, vMax: 0.05, uMin: 0.42, uMax: 0.58, en: 'Petiole base touching bottom edge', vi: 'Cuống lá chạm mép dưới' },
    silhouettePolicy: 'relaxed',
    backPolicy: 'mirror',
    materialGroup: 'foliage'
  },
  petal: {
    alphaMode: 'cutout',
    symmetry: bilateral,
    anchorUV: [0.5, 0.0],
    tipUV: [0.5, 1.0],
    attachmentBand: { vMin: 0.0, vMax: 0.04, uMin: 0.40, uMax: 0.60, en: 'Narrow petal claw touching bottom edge', vi: 'Gốc hẹp của cánh chạm mép dưới' },
    silhouettePolicy: 'relaxed',
    backPolicy: 'same',
    materialGroup: 'petal'
  },
  stem: {
    alphaMode: 'cutout',
    symmetry: bilateral,
    anchorUV: [0.5, 0.0],
    tipUV: [0.5, 1.0],
    attachmentBand: { vMin: 0.0, vMax: 0.02, uMin: 0.35, uMax: 0.65, en: 'Stem base touches canvas bottom edge', vi: 'Gốc thân chạm đáy ảnh' },
    silhouettePolicy: 'relaxed',
    backPolicy: 'same',
    materialGroup: 'stem'
  },
  center: {
    alphaMode: 'cutout',
    symmetry: {
      en: 'Circular silhouette centered at (50%,50%), diameter 92% of canvas width; approximately radial symmetry, natural seed texture allowed.',
      vi: 'Viền tròn tâm (50%,50%), đường kính bằng 92% chiều rộng ảnh; gần đối xứng tỏa tròn, cho phép hạt tự nhiên.'
    },
    anchorUV: [0.5, 0.5],
    tipUV: [0.5, 0.96],
    silhouettePolicy: 'relaxed',
    backPolicy: 'same',
    materialGroup: 'center'
  },
  pot: {
    alphaMode: 'opaque',
    symmetry: rectangular,
    anchorUV: [0.5, 0.5],
    silhouettePolicy: 'opaque',
    backPolicy: 'same',
    materialGroup: 'pot'
  },
  bottom: {
    alphaMode: 'opaque',
    symmetry: rectangular,
    anchorUV: [0.5, 0.5],
    silhouettePolicy: 'opaque',
    backPolicy: 'same',
    materialGroup: 'pot'
  },
  soil: {
    alphaMode: 'opaque',
    symmetry: organic,
    anchorUV: [0.5, 0.5],
    silhouettePolicy: 'opaque',
    backPolicy: 'same',
    materialGroup: 'soil'
  },
  front: {
    alphaMode: 'opaque',
    symmetry: elevation,
    anchorUV: [0.5, 0.0],
    tipUV: [0.5, 1.0],
    silhouettePolicy: 'opaque',
    backPolicy: 'same',
    materialGroup: 'facade'
  },
  side: {
    alphaMode: 'opaque',
    symmetry: elevation,
    anchorUV: [0.5, 0.0],
    tipUV: [0.5, 1.0],
    silhouettePolicy: 'opaque',
    backPolicy: 'same',
    materialGroup: 'facade'
  },
  roof: {
    alphaMode: 'opaque',
    symmetry: rectangular,
    anchorUV: [0.5, 0.5],
    silhouettePolicy: 'opaque',
    backPolicy: 'same',
    materialGroup: 'decor'
  },
  panel: {
    alphaMode: 'cutout',
    symmetry: {
      en: 'Center the railing pattern with left/right balanced posts; repeat bars at even spacing. Keep every bar connected to the panel, with transparent gaps, no floating ornaments.',
      vi: 'Hoa văn ở giữa, trụ cân hai bên, song cách đều. Các thanh phải nối vào tấm song, khe trong suốt, không có họa tiết rời lơ lửng.'
    },
    anchorUV: [0.5, 0.0],
    tipUV: [0.5, 1.0],
    attachmentBand: { vMin: 0.0, vMax: 0.04, en: 'Bottom of baluster posts touch bottom edge', vi: 'Chân các cột song chạm mép dưới' },
    silhouettePolicy: 'relaxed',
    backPolicy: 'mirror',
    materialGroup: 'metal'
  },
  rail: {
    alphaMode: 'opaque',
    symmetry: rectangular,
    anchorUV: [0.5, 0.5],
    silhouettePolicy: 'opaque',
    backPolicy: 'same',
    materialGroup: 'metal'
  },
  grass: {
    alphaMode: 'cutout',
    symmetry: organic,
    anchorUV: [0.5, 0.0],
    tipUV: [0.5, 1.0],
    attachmentBand: { vMin: 0.0, vMax: 0.05, uMin: 0.35, uMax: 0.65, en: 'Grass roots cluster at bottom edge', vi: 'Chùm rễ cỏ chạm mép dưới' },
    silhouettePolicy: 'relaxed',
    backPolicy: 'mirror',
    materialGroup: 'foliage'
  },
  stamen: {
    alphaMode: 'cutout',
    symmetry: {
      en: 'Slender cluster of stamens centered at x=50%, roughly left/right symmetric; natural curved filaments allowed.',
      vi: 'Chùm nhụy dài ở giữa qua x=50%, gần đối xứng hai bên; các sợi nhụy có thể uốn lượn tự nhiên.'
    },
    anchorUV: [0.5, 0.0],
    tipUV: [0.5, 1.0],
    attachmentBand: { vMin: 0.0, vMax: 0.05, uMin: 0.40, uMax: 0.60, en: 'Stamen stalk base touching bottom edge', vi: 'Gốc cuống nhụy chạm mép đáy' },
    silhouettePolicy: 'relaxed',
    backPolicy: 'same',
    materialGroup: 'center'
  },
  blade: {
    alphaMode: 'cutout',
    symmetry: bilateral,
    anchorUV: [0.5, 0.0],
    tipUV: [0.5, 1.0],
    attachmentBand: { vMin: 0.0, vMax: 0.04, uMin: 0.44, uMax: 0.56, en: 'Blade root sheath touches bottom edge', vi: 'Bẹ gốc lá cỏ chạm mép dưới' },
    silhouettePolicy: 'relaxed',
    backPolicy: 'mirror',
    materialGroup: 'foliage'
  },
  spathe: {
    alphaMode: 'cutout',
    symmetry: organic,
    anchorUV: [0.5, 0.0],
    tipUV: [0.5, 1.0],
    attachmentBand: { vMin: 0.0, vMax: 0.05, uMin: 0.40, uMax: 0.60, en: 'Spathe base touching bottom edge', vi: 'Cuống cánh mo chạm mép dưới' },
    silhouettePolicy: 'relaxed',
    backPolicy: 'same',
    materialGroup: 'petal'
  },
  spadix: {
    alphaMode: 'cutout',
    symmetry: bilateral,
    anchorUV: [0.5, 0.0],
    tipUV: [0.5, 1.0],
    attachmentBand: { vMin: 0.0, vMax: 0.05, uMin: 0.40, uMax: 0.60, en: 'Spadix base touching bottom edge', vi: 'Đáy trụ nhụy chạm mép dưới' },
    silhouettePolicy: 'relaxed',
    backPolicy: 'same',
    materialGroup: 'center'
  },
  calyx: {
    alphaMode: 'cutout',
    symmetry: bilateral,
    anchorUV: [0.5, 0.5],
    tipUV: [0.5, 1.0],
    silhouettePolicy: 'relaxed',
    backPolicy: 'same',
    materialGroup: 'foliage'
  }
}

export const IMAGE_ALPHA_RULES = {
  cutout: {
    en: 'Use real transparent alpha outside the silhouette and in holes, never a painted checkerboard. Follow the specified padding and attachment edges.',
    vi: 'Alpha trong suốt thật ngoài đường viền và trong lỗ, không vẽ nền caro. Giữ viền đệm và mép gắn theo mô tả.'
  },
  opaque: {
    en: 'This is a solid surface: fill the entire canvas with opaque material, alpha=255 through all four edges; no transparent padding or holes.',
    vi: 'Đây là bề mặt kín: vật liệu phủ kín canvas, alpha=255 tới cả bốn mép; không viền đệm trong suốt hoặc lỗ.'
  }
}
