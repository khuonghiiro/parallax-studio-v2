/**
 * Shared building blocks for the bilingual MCP tool catalogue.
 *
 * Every tool spec carries BOTH languages side by side — `doc: L(en, vi)` for the tool and
 * `d(en, vi)` for each parameter — so the English and Vietnamese docs can never drift apart
 * (catalog.test.mjs enforces identical structure). The active language only decides which
 * string is emitted.
 */
import { z } from 'zod'

/** Pair of texts: English first (default for AI agents), Vietnamese second. */
export const L = (en, vi) => ({ en, vi })

/** Picks the text for `lang` from a pair. */
export const pick = (pair, lang) => (lang === 'vi' ? pair.vi : pair.en)

/** Builds the `d(en, vi)` describer used by shape factories for one language. */
export const describer = (lang) => (en, vi) => (lang === 'vi' ? vi : en)

export const vec3 = z.tuple([z.number(), z.number(), z.number()])
export const ease = z.enum(['linear', 'easeIn', 'easeOut', 'easeInOut', 'easeInOutStrong', 'hold'])
export const blend = z.enum(['normal', 'add', 'screen', 'multiply'])

export const shotId = (d) =>
  z
    .string()
    .nullable()
    .optional()
    .describe(
      d(
        'Owning shot id (or shot name). null/"global" = global layer visible from every shot. Omit = currently selected shot.',
        'Id (hoặc tên) shot chứa layer. null/"global" = layer toàn cục thấy ở mọi shot. Bỏ trống = shot đang chọn.'
      )
    )

export const atTime = (d) =>
  z
    .number()
    .optional()
    .describe(d('If set, write a keyframe at this time (s) instead of changing the static value.', 'Nếu đặt, ghi keyframe tại thời điểm này (giây) thay vì đổi giá trị tĩnh.'))

export const layerCommon = (d) => ({
  shot_id: shotId(d),
  name: z.string().optional(),
  position: vec3.optional().describe(d('LOCAL position inside the shot [x, y, z]; z = depth, positive = farther.', 'Vị trí CỤC BỘ trong shot [x, y, z]; z = độ sâu, dương = xa hơn.')),
  z: z.number().optional().describe(d('Shortcut to set only the depth.', 'Lối tắt chỉ đặt độ sâu.')),
  rotation: vec3.optional().describe(d('Degrees [x, y, z].', 'Độ [x, y, z].')),
  orientation: z
    .enum(['vertical', 'ground', 'tilted', 'ceiling'])
    .optional()
    .describe(
      d(
        'Preset: "ground" (horizontal [-90,0,0]), "tilted" (slope [-75,0,0]), "ceiling" ([90,0,0]), "vertical" ([0,0,0]).',
        'Preset: "ground" (nằm ngang [-90,0,0]), "tilted" (dốc [-75,0,0]), "ceiling" ([90,0,0]), "vertical" ([0,0,0]).'
      )
    ),
  scale: z.union([z.number(), vec3]).optional().describe(d('Number (uniform) or [x, y, z]. 1 = 100%.', 'Số (đồng đều) hoặc [x, y, z]. 1 = 100%.')),
  opacity: z.number().min(0).max(1).optional(),
  blend_mode: blend.optional(),
  auto_scale: z.boolean().optional().describe(d('Keep apparent size constant when pushed in depth (default true).', 'Giữ kích thước nhìn thấy không đổi khi đẩy theo chiều sâu (mặc định true).')),
  in_point: z.number().optional(),
  out_point: z.number().optional(),
  visible: z.boolean().optional()
})

export { z }
