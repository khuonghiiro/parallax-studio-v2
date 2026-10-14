function svgCutout(width: number, height: number, body: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

// ---------------------------------------------------------------------------
// 1. Pet Dog (Golden Retriever / Corgi, facing left, 12 slots)
// ---------------------------------------------------------------------------
function dogThigh(far: boolean): string {
  const fill = far ? '#b45309' : '#d97706'
  const stroke = far ? '#451a03' : '#78350f'
  return svgCutout(
    48,
    68,
    `<path d="M12 10 Q26 -2 38 12 L34 56 Q22 66 12 56 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.8" stroke-linejoin="round"/>`
  )
}

function dogShin(far: boolean): string {
  const fill = far ? '#b45309' : '#f59e0b'
  const paw = far ? '#fde68a' : '#fef3c7'
  const stroke = far ? '#451a03' : '#78350f'
  return svgCutout(
    44,
    66,
    `<path d="M14 8 Q24 0 34 8 L32 50 H16 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.8"/>
    <path d="M6 48 H34 Q38 60 28 62 H8 Q2 56 6 48 Z" fill="${paw}" stroke="${stroke}" stroke-width="1.8"/>`
  )
}

export const DOG_ART = {
  head: svgCutout(
    112,
    92,
    `<path d="M46 20 Q82 14 96 42 L106 72 L64 78 Q38 76 34 58 L10 54 Q4 44 10 34 L36 30 Q40 22 46 20 Z" fill="#f59e0b" stroke="#78350f" stroke-width="2" stroke-linejoin="round"/>
    <path d="M10 46 Q24 58 46 54 L44 68 Q26 70 16 58 Z" fill="#fef3c7" stroke="#78350f" stroke-width="1.5"/>
    <path d="M24 58 Q28 70 36 62 Z" fill="#fb7185" stroke="#881337" stroke-width="1.4"/>
    <circle cx="10" cy="38" r="5" fill="#1e293b"/>
    <circle cx="46" cy="36" r="5.5" fill="#1e293b"/><circle cx="44" cy="34" r="2" fill="#fff"/>
    <path d="M66 56 L98 70 L92 80 L60 66 Z" fill="#dc2626" stroke="#7f1d1d" stroke-width="1.8"/>
    <circle cx="66" cy="74" r="5" fill="#fbbf24" stroke="#78350f" stroke-width="1.4"/>`
  ),
  ear: svgCutout(
    46,
    62,
    `<path d="M16 6 Q36 4 40 24 Q42 52 24 58 Q8 54 10 28 Q10 10 16 6 Z" fill="#b45309" stroke="#451a03" stroke-width="2"/>`
  ),
  torso: svgCutout(
    168,
    96,
    `<path d="M18 28 Q52 14 132 20 Q158 26 156 54 Q152 80 118 76 Q74 72 44 82 Q12 80 10 52 Q10 34 18 28 Z" fill="#f59e0b" stroke="#78350f" stroke-width="2" stroke-linejoin="round"/>
    <path d="M14 48 Q26 78 68 76 Q42 64 24 44 Z" fill="#fef3c7"/>`
  ),
  tail: svgCutout(
    74,
    72,
    `<path d="M8 54 Q26 44 46 14 Q64 4 68 22 Q64 52 24 64 Q8 66 8 54 Z" fill="#f59e0b" stroke="#78350f" stroke-width="2"/>
    <path d="M44 16 Q62 6 66 22 Q58 36 42 32 Z" fill="#fef3c7"/>`
  ),
  thighNear: dogThigh(false),
  thighFar: dogThigh(true),
  shinNear: dogShin(false),
  shinFar: dogShin(true)
}

// ---------------------------------------------------------------------------
// 2. Water Buffalo (Con Trâu Đồng, facing left, 12 slots)
// ---------------------------------------------------------------------------
function buffaloThigh(far: boolean): string {
  const fill = far ? '#1e293b' : '#334155'
  return svgCutout(
    54,
    74,
    `<path d="M10 10 Q27 -2 44 10 L38 62 Q27 72 14 62 Z" fill="${fill}" stroke="#0f172a" stroke-width="2"/>`
  )
}

function buffaloShin(far: boolean): string {
  const fill = far ? '#1e293b' : '#334155'
  return svgCutout(
    46,
    72,
    `<path d="M14 8 Q24 0 34 8 L32 54 H14 Z" fill="${fill}" stroke="#0f172a" stroke-width="2"/>
    <path d="M8 54 H34 L36 66 H22 L20 60 L18 66 H6 Z" fill="#0f172a" stroke="#020617" stroke-width="1.6"/>`
  )
}

export const BUFFALO_ART = {
  head: svgCutout(
    140,
    106,
    `<path d="M52 26 Q98 8 134 18 Q112 30 78 36 Z" fill="#1e293b" stroke="#020617" stroke-width="2"/>
    <path d="M42 36 Q84 30 116 48 L124 84 L74 88 Q44 86 14 74 Q4 64 10 50 L36 40 Z" fill="#334155" stroke="#0f172a" stroke-width="2" stroke-linejoin="round"/>
    <path d="M56 30 Q108 14 136 28 Q106 44 64 44 Z" fill="#0f172a" stroke="#020617" stroke-width="2"/>
    <ellipse cx="16" cy="62" rx="10" ry="8" fill="#1e293b" stroke="#0f172a" stroke-width="1.6"/>
    <circle cx="14" cy="66" r="6" fill="none" stroke="#fbbf24" stroke-width="2.2"/>
    <circle cx="48" cy="50" r="4.5" fill="#020617"/><circle cx="46.5" cy="48.5" r="1.5" fill="#fff"/>`
  ),
  ear: svgCutout(
    46,
    34,
    `<path d="M6 14 Q26 4 42 16 Q28 30 8 24 Z" fill="#334155" stroke="#0f172a" stroke-width="1.8"/>
    <path d="M12 16 Q26 10 36 17 Q26 24 12 20 Z" fill="#64748b"/>`
  ),
  torso: svgCutout(
    206,
    118,
    `<path d="M16 32 Q58 10 104 18 Q166 18 192 38 Q200 76 176 92 Q112 106 44 98 Q10 90 12 52 Z" fill="#334155" stroke="#0f172a" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M36 26 Q88 18 156 28" fill="none" stroke="#475569" stroke-width="3" opacity="0.7"/>`
  ),
  tail: svgCutout(
    64,
    96,
    `<path d="M10 12 Q38 24 46 64" fill="none" stroke="#334155" stroke-width="6" stroke-linecap="round"/>
    <path d="M40 60 Q58 68 54 90 Q36 86 38 64 Z" fill="#0f172a" stroke="#020617" stroke-width="1.8"/>`
  ),
  thighNear: buffaloThigh(false),
  thighFar: buffaloThigh(true),
  shinNear: buffaloShin(false),
  shinFar: buffaloShin(true)
}

// ---------------------------------------------------------------------------
// 3. Feline Cat (Mèo Con, facing left, 11 slots)
// ---------------------------------------------------------------------------
function catThigh(far: boolean): string {
  const fill = far ? '#c2410c' : '#fb923c'
  const stroke = far ? '#431407' : '#7c2d12'
  return svgCutout(
    42,
    62,
    `<path d="M12 8 Q22 -1 32 8 L28 52 Q20 60 12 52 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/>`
  )
}

function catShin(far: boolean): string {
  const fill = far ? '#c2410c' : '#fb923c'
  const stroke = far ? '#431407' : '#7c2d12'
  return svgCutout(
    38,
    60,
    `<path d="M12 6 Q20 0 28 6 L26 44 H14 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/>
    <path d="M6 42 H28 Q32 54 22 56 H8 Q3 50 6 42 Z" fill="#fff7ed" stroke="${stroke}" stroke-width="1.6"/>`
  )
}

export const CAT_ART = {
  head: svgCutout(
    96,
    88,
    `<path d="M22 28 L16 6 L38 20 Z M54 20 L74 6 L68 30 Z" fill="#fb923c" stroke="#7c2d12" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M22 24 L19 11 L33 20 Z M57 20 L70 11 L65 26 Z" fill="#fda4af"/>
    <ellipse cx="46" cy="48" rx="34" ry="28" fill="#fb923c" stroke="#7c2d12" stroke-width="1.8"/>
    <path d="M14 48 Q26 68 48 66 Q28 74 16 58 Z" fill="#fff7ed"/>
    <ellipse cx="30" cy="44" rx="6.5" ry="7" fill="#10b981" stroke="#064e3b" stroke-width="1.4"/>
    <ellipse cx="30" cy="44" rx="2" ry="5" fill="#064e3b"/><circle cx="28" cy="41" r="1.8" fill="#fff"/>
    <polygon points="12,48 18,45 16,52" fill="#f43f5e"/>
    <path d="M18 54 L4 50 M18 57 L4 58 M18 60 L6 65" stroke="#7c2d12" stroke-width="1.3" stroke-linecap="round"/>`
  ),
  torso: svgCutout(
    152,
    84,
    `<path d="M18 32 Q68 12 128 24 Q146 34 142 56 Q134 74 96 68 Q56 64 28 72 Q10 68 12 46 Z" fill="#fb923c" stroke="#7c2d12" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M48 20 L44 38 M72 18 L68 36 M96 20 L92 38" stroke="#c2410c" stroke-width="4" stroke-linecap="round"/>`
  ),
  tail: svgCutout(
    76,
    94,
    `<path d="M10 76 Q44 68 48 36 Q50 10 68 14" fill="none" stroke="#7c2d12" stroke-width="15" stroke-linecap="round"/>
    <path d="M10 76 Q44 68 48 36 Q50 10 68 14" fill="none" stroke="#fb923c" stroke-width="11" stroke-linecap="round"/>`
  ),
  thighNear: catThigh(false),
  thighFar: catThigh(true),
  shinNear: catShin(false),
  shinFar: catShin(true)
}

// ---------------------------------------------------------------------------
// 4. Japanese Koi Fish (Cá Chép Koi, facing left, 7 slots)
// ---------------------------------------------------------------------------
export const FISH_ART = {
  head: svgCutout(
    98,
    82,
    `<path d="M8 42 Q26 12 82 16 Q94 41 82 66 Q26 70 8 42 Z" fill="#fff7ed" stroke="#9a3412" stroke-width="2" stroke-linejoin="round"/>
    <path d="M32 22 Q56 16 74 28 Q68 48 44 46 Q26 38 32 22 Z" fill="#ef4444"/>
    <path d="M12 44 Q4 54 14 62 M16 40 Q6 30 16 24" fill="none" stroke="#ea580c" stroke-width="2.2" stroke-linecap="round"/>
    <circle cx="28" cy="34" r="4.5" fill="#0f172a"/><circle cx="26.5" cy="32.5" r="1.5" fill="#fff"/>
    <path d="M68 22 Q58 41 68 60" fill="none" stroke="#fdba74" stroke-width="2.2"/>`
  ),
  mid: svgCutout(
    106,
    88,
    `<path d="M10 18 Q54 8 94 22 Q102 44 94 66 Q54 80 10 70 Q2 44 10 18 Z" fill="#fff7ed" stroke="#9a3412" stroke-width="2"/>
    <path d="M22 16 Q62 12 82 28 Q72 52 42 48 Q18 36 22 16 Z" fill="#ef4444"/>
    <path d="M52 52 Q76 46 88 62 Q68 74 48 68 Z" fill="#f97316"/>`
  ),
  tailBase: svgCutout(
    84,
    66,
    `<path d="M8 14 Q44 16 76 26 Q80 33 76 40 Q44 50 8 52 Q2 33 8 14 Z" fill="#fff7ed" stroke="#9a3412" stroke-width="2"/>
    <path d="M18 18 Q46 20 64 28 Q54 42 24 38 Z" fill="#ef4444"/>`
  ),
  tailFin: svgCutout(
    96,
    112,
    `<path d="M6 48 Q46 12 88 8 Q72 42 52 56 Q72 70 88 104 Q46 100 6 64 Z" fill="#fed7aa" fill-opacity="0.88" stroke="#ea580c" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M12 52 Q48 28 78 18 M12 56 H64 M12 60 Q48 84 78 94" fill="none" stroke="#fb923c" stroke-width="1.6"/>`
  ),
  dorsalFin: svgCutout(
    80,
    46,
    `<path d="M8 38 Q24 6 72 12 Q58 28 62 40 Z" fill="#fed7aa" fill-opacity="0.88" stroke="#ea580c" stroke-width="1.8"/>`
  ),
  pectoralNear: svgCutout(
    62,
    48,
    `<path d="M14 8 Q52 14 56 36 Q28 46 8 24 Z" fill="#fed7aa" fill-opacity="0.9" stroke="#ea580c" stroke-width="1.8"/>`
  ),
  pectoralFar: svgCutout(
    58,
    44,
    `<path d="M14 36 Q48 30 52 10 Q26 4 8 22 Z" fill="#fdba74" fill-opacity="0.82" stroke="#c2410c" stroke-width="1.8"/>`
  )
}

// ---------------------------------------------------------------------------
// 5. Proud Rooster (Gà Trống Mào Đỏ, facing left, 9 slots)
// ---------------------------------------------------------------------------
function roosterThigh(far: boolean): string {
  const fill = far ? '#9a3412' : '#c2410c'
  return svgCutout(
    48,
    60,
    `<path d="M10 8 Q24 -2 38 10 L32 50 Q24 58 14 50 Z" fill="${fill}" stroke="#431407" stroke-width="1.8"/>`
  )
}

function roosterShin(far: boolean): string {
  const fill = far ? '#d97706' : '#f59e0b'
  return svgCutout(
    54,
    66,
    `<path d="M24 6 H32 L30 48 H22 Z M30 34 L44 30 L30 40 Z" fill="${fill}" stroke="#78350f" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M6 52 L24 46 L42 52 M12 58 L24 48 L34 58" fill="none" stroke="${fill}" stroke-width="3.5" stroke-linecap="round"/>`
  )
}

export const ROOSTER_ART = {
  head: svgCutout(
    90,
    96,
    `<path d="M26 28 Q20 8 32 14 Q38 2 48 14 Q58 4 64 18 Q74 12 68 30 Z" fill="#dc2626" stroke="#7f1d1d" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M24 38 L6 44 L24 50 Z" fill="#fbbf24" stroke="#78350f" stroke-width="1.8"/>
    <path d="M22 48 Q16 66 28 68 Q36 64 32 50 Z" fill="#dc2626" stroke="#7f1d1d" stroke-width="1.6"/>
    <path d="M24 30 Q48 22 64 38 L78 82 Q52 92 28 80 Z" fill="#f59e0b" stroke="#78350f" stroke-width="1.8"/>
    <path d="M32 66 L42 84 L52 68 L62 84 L72 68" fill="none" stroke="#b45309" stroke-width="2"/>
    <circle cx="36" cy="40" r="4" fill="#0f172a"/><circle cx="35" cy="39" r="1.4" fill="#fff"/>`
  ),
  torso: svgCutout(
    126,
    106,
    `<path d="M16 34 Q44 16 98 26 Q116 48 104 80 Q68 100 28 86 Q6 68 16 34 Z" fill="#b45309" stroke="#431407" stroke-width="2" stroke-linejoin="round"/>
    <path d="M16 44 Q10 74 48 88 Q74 92 92 78 Q56 68 36 38 Z" fill="#065f46"/>`
  ),
  wingL: svgCutout(
    82,
    68,
    `<path d="M12 18 Q44 6 74 26 Q66 56 26 58 Q6 44 12 18 Z" fill="#ea580c" stroke="#431407" stroke-width="1.8"/>
    <path d="M24 36 Q52 30 70 40 Q56 56 26 56 Z" fill="#0f766e"/>`
  ),
  wingR: svgCutout(
    76,
    62,
    `<path d="M10 16 Q40 6 68 24 Q60 52 24 54 Q6 40 10 16 Z" fill="#9a3412" stroke="#431407" stroke-width="1.8"/>`
  ),
  tail: svgCutout(
    116,
    132,
    `<path d="M8 86 Q28 22 86 12 Q110 18 104 42 Q76 32 42 76 Z" fill="#065f46" stroke="#022c22" stroke-width="2"/>
    <path d="M12 94 Q42 42 96 38 Q112 52 98 72 Q68 58 34 94 Z" fill="#1e3a8a" stroke="#0f172a" stroke-width="1.8"/>
    <path d="M14 102 Q48 66 92 74 Q98 92 78 102 Q52 88 22 108 Z" fill="#047857" stroke="#022c22" stroke-width="1.8"/>`
  ),
  thighNear: roosterThigh(false),
  thighFar: roosterThigh(true),
  shinNear: roosterShin(false),
  shinFar: roosterShin(true)
}

// ---------------------------------------------------------------------------
// 6. Mystical Fireflies VFX Cutout for Ancient Ruins Template
// ---------------------------------------------------------------------------
export const RUINS_FIREFLIES_ART = svgCutout(
  260,
  220,
  `<defs>
    <radialGradient id="ff"><stop offset="0%" stop-color="#fef08a"/><stop offset="45%" stop-color="#a3e635" stop-opacity="0.75"/><stop offset="100%" stop-color="#4d7c0f" stop-opacity="0"/></radialGradient>
  </defs>
  <circle cx="48" cy="52" r="18" fill="url(#ff)"/><circle cx="48" cy="52" r="4" fill="#fef9c3"/>
  <circle cx="132" cy="36" r="22" fill="url(#ff)"/><circle cx="132" cy="36" r="5" fill="#fef9c3"/>
  <circle cx="208" cy="68" r="16" fill="url(#ff)"/><circle cx="208" cy="68" r="3.5" fill="#fef9c3"/>
  <circle cx="84" cy="118" r="24" fill="url(#ff)"/><circle cx="84" cy="118" r="5.5" fill="#fef9c3"/>
  <circle cx="176" cy="134" r="20" fill="url(#ff)"/><circle cx="176" cy="134" r="4.5" fill="#fef9c3"/>
  <circle cx="52" cy="176" r="15" fill="url(#ff)"/><circle cx="52" cy="176" r="3.5" fill="#fef9c3"/>
  <circle cx="138" cy="182" r="18" fill="url(#ff)"/><circle cx="138" cy="182" r="4" fill="#fef9c3"/>
  <circle cx="218" cy="164" r="14" fill="url(#ff)"/><circle cx="218" cy="164" r="3" fill="#fef9c3"/>`
)
