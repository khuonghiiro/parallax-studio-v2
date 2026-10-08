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

export const IMAGE_MESH_SLOT_RULES = {
  leaf: { alphaMode: 'cutout', symmetry: bilateral },
  petal: { alphaMode: 'cutout', symmetry: bilateral },
  stem: { alphaMode: 'cutout', symmetry: bilateral },
  center: { alphaMode: 'cutout', symmetry: {
    en: 'Circular silhouette centered at (50%,50%), diameter 92% of canvas width; approximately radial symmetry, natural seed texture allowed.',
    vi: 'Viền tròn tâm (50%,50%), đường kính bằng 92% chiều rộng ảnh; gần đối xứng tỏa tròn, cho phép hạt tự nhiên.'
  } },
  pot: { alphaMode: 'opaque', symmetry: rectangular },
  bottom: { alphaMode: 'opaque', symmetry: rectangular },
  soil: { alphaMode: 'opaque', symmetry: organic },
  front: { alphaMode: 'opaque', symmetry: elevation },
  side: { alphaMode: 'opaque', symmetry: elevation },
  roof: { alphaMode: 'opaque', symmetry: rectangular },
  panel: { alphaMode: 'cutout', symmetry: {
    en: 'Center the railing pattern with left/right balanced posts; repeat bars at even spacing. Keep every bar connected to the panel, with transparent gaps, no floating ornaments.',
    vi: 'Hoa văn ở giữa, trụ cân hai bên, song cách đều. Các thanh phải nối vào tấm song, khe trong suốt, không có họa tiết rời lơ lửng.'
  } },
  rail: { alphaMode: 'opaque', symmetry: rectangular },
  grass: { alphaMode: 'cutout', symmetry: organic }
} as const

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
