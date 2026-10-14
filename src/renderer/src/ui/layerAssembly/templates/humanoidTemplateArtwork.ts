function svgCutout(width: number, height: number, body: string, mirror = false): string {
  const g = mirror ? `<g transform="translate(${width} 0) scale(-1 1)">${body}</g>` : body
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${g}</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

// ---------------------------------------------------------------------------
// 1. Disguise & Prop Cutouts for Adult Male Hero (scale: 0.5 in template)
// ---------------------------------------------------------------------------
export const HERO_PROP_ART = {
  cape: svgCutout(
    280,
    420,
    `<defs><linearGradient id="hc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#b91c1c"/><stop offset="100%" stop-color="#7f1d1d"/></linearGradient></defs>
    <path d="M68 18 Q140 34 212 18 L258 382 Q200 412 140 392 Q80 412 22 382 Z" fill="url(#hc)" stroke="#450a0a" stroke-width="4" stroke-linejoin="round"/>
    <path d="M92 32 L64 368 M140 36 L140 382 M188 32 L216 368" stroke="#991b1b" stroke-width="3" fill="none" opacity="0.65"/>
    <path d="M62 14 Q140 32 218 14 L226 36 Q140 52 54 36 Z" fill="#d97706" stroke="#78350f" stroke-width="3"/>`
  ),
  beard: svgCutout(
    110,
    88,
    `<path d="M16 18 Q36 8 55 20 Q74 8 94 18 Q98 54 78 74 Q55 86 32 74 Q12 54 16 18 Z" fill="#5c3a21" stroke="#2e1a0f" stroke-width="3" stroke-linejoin="round"/>
    <path d="M26 22 Q55 34 84 22 Q74 42 55 42 Q36 42 26 22 Z" fill="#3b2313"/>
    <path d="M48 56 H62 V78 H48 Z" fill="#d97706" stroke="#78350f" stroke-width="2"/>`
  ),
  glasses: svgCutout(
    116,
    46,
    `<rect x="10" y="10" width="42" height="26" rx="7" fill="#0ea5e9" fill-opacity="0.55" stroke="#fbbf24" stroke-width="3.5"/>
    <rect x="64" y="10" width="42" height="26" rx="7" fill="#0ea5e9" fill-opacity="0.55" stroke="#fbbf24" stroke-width="3.5"/>
    <path d="M52 21 H64 M4 18 H10 M106 18 H112" stroke="#fbbf24" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M18 15 L28 31 M72 15 L82 31" stroke="#e0f2fe" stroke-width="2.5" stroke-linecap="round"/>`
  ),
  mask: svgCutout(
    114,
    78,
    `<path d="M12 18 Q57 6 102 18 L94 56 Q57 74 20 56 Z" fill="#334155" stroke="#0f172a" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M57 12 V66 M34 24 V56 M80 24 V56" stroke="#94a3b8" stroke-width="3" stroke-linecap="round"/>
    <path d="M16 20 Q57 10 98 20" stroke="#fbbf24" stroke-width="2.5" fill="none"/>`
  ),
  hat: svgCutout(
    150,
    112,
    `<path d="M75 6 Q112 6 122 46 L128 84 Q75 68 22 84 L28 46 Q38 6 75 6 Z" fill="#64748b" stroke="#1e293b" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M68 4 Q75 -2 82 4 L86 48 H64 Z" fill="#dc2626" stroke="#7f1d1d" stroke-width="2.5"/>
    <path d="M18 76 Q75 58 132 76 L138 94 Q75 78 12 94 Z" fill="#fbbf24" stroke="#78350f" stroke-width="3"/>`
  ),
  weapon: svgCutout(
    92,
    260,
    `<path d="M46 8 L58 34 L54 186 H38 L34 34 Z" fill="#e2e8f0" stroke="#334155" stroke-width="3" stroke-linejoin="round"/>
    <path d="M46 14 V184" stroke="#94a3b8" stroke-width="2"/>
    <path d="M14 184 Q46 194 78 184 L82 198 Q46 208 10 198 Z" fill="#fbbf24" stroke="#78350f" stroke-width="3"/>
    <rect x="40" y="198" width="12" height="36" rx="4" fill="#7c2d12" stroke="#431407" stroke-width="2.5"/>
    <circle cx="46" cy="242" r="10" fill="#fbbf24" stroke="#78350f" stroke-width="3"/>`
  )
}

// ---------------------------------------------------------------------------
// 2. Young Female / Anime Schoolgirl Cutout Set (12 slots, scale: 1.0)
// ---------------------------------------------------------------------------
const animeArm = `<path d="M6 10 Q16 -2 26 10 L29 44 Q16 50 3 44 Z" fill="#f8fafc" stroke="#334155" stroke-width="1.6"/>
  <path d="M4 40 H28" stroke="#1e3a8a" stroke-width="3"/>
  <path d="M9 44 H23 L22 58 Q16 64 10 58 Z" fill="#fde2c8" stroke="#9a6b50" stroke-width="1.4"/>`

const animeThigh = `<path d="M5 8 Q16 -2 27 8 L25 42 H7 Z" fill="#fde2c8" stroke="#9a6b50" stroke-width="1.5"/>
  <path d="M7 34 H25 L24 72 Q16 80 8 72 Z" fill="#1e293b" stroke="#0f172a" stroke-width="1.5"/>`

const animeShin = `<path d="M8 8 Q19 -2 30 8 L28 66 H10 Z" fill="#1e293b" stroke="#0f172a" stroke-width="1.5"/>
  <path d="M6 64 H31 L35 78 Q36 86 24 86 H6 Q3 76 6 64 Z" fill="#5c3a21" stroke="#2e1a0f" stroke-width="1.6"/>
  <ellipse cx="19" cy="67" rx="8" ry="3.5" fill="#f8fafc"/>`

export const ANIME_GIRL_ART = {
  hairBack: svgCutout(
    118,
    165,
    `<path d="M24 14 Q59 2 94 14 Q112 58 114 148 Q98 162 84 144 Q78 96 74 72 H44 Q40 96 34 144 Q20 162 4 148 Q6 58 24 14 Z" fill="#c4b5fd" stroke="#4c1d95" stroke-width="2" stroke-linejoin="round"/>
    <path d="M18 42 Q12 95 16 142 M100 42 Q106 95 102 142" stroke="#a78bfa" stroke-width="2" fill="none"/>`
  ),
  head: svgCutout(
    76,
    86,
    `<rect x="31" y="64" width="14" height="18" rx="6" fill="#fde2c8" stroke="#9a6b50" stroke-width="1.5"/>
    <path d="M15 30 Q14 64 38 70 Q62 64 61 30 Q60 12 38 12 Q16 12 15 30 Z" fill="#fde2c8" stroke="#9a6b50" stroke-width="1.6"/>
    <ellipse cx="27" cy="43" rx="5.5" ry="6.5" fill="#4f46e5"/><circle cx="25.5" cy="41" r="2" fill="#fff"/>
    <ellipse cx="49" cy="43" rx="5.5" ry="6.5" fill="#4f46e5"/><circle cx="47.5" cy="41" r="2" fill="#fff"/>
    <ellipse cx="21" cy="51" rx="4" ry="2" fill="#fda4af" opacity="0.7"/>
    <ellipse cx="55" cy="51" rx="4" ry="2" fill="#fda4af" opacity="0.7"/>
    <path d="M33 56 Q38 61 43 56" fill="none" stroke="#be123c" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M11 36 Q10 8 38 6 Q66 8 65 36 L59 24 L51 34 L43 22 L38 35 L31 22 L24 34 L16 24 Z" fill="#ddd6fe" stroke="#4c1d95" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M12 16 L24 22 L15 29 Z M64 16 L52 22 L61 29 Z" fill="#e11d48" stroke="#881337" stroke-width="1.4"/>`
  ),
  torso: svgCutout(
    78,
    96,
    `<path d="M16 14 L62 14 L66 86 Q39 94 12 86 Z" fill="#f8fafc" stroke="#334155" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M14 14 L39 42 L64 14 L56 10 L39 28 L22 10 Z" fill="#1e3a8a" stroke="#0f172a" stroke-width="1.5"/>
    <path d="M18 15 L39 38 L60 15" fill="none" stroke="#f8fafc" stroke-width="1.4"/>
    <path d="M39 36 L26 46 L31 54 L39 44 L47 54 L52 46 Z" fill="#e11d48" stroke="#881337" stroke-width="1.4"/>
    <circle cx="39" cy="40" r="4.5" fill="#fb7185" stroke="#881337" stroke-width="1.2"/>`
  ),
  pelvis: svgCutout(
    86,
    54,
    `<path d="M16 4 H70 L78 46 Q43 52 8 46 Z" fill="#1e3a8a" stroke="#0f172a" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M16 4 H70 V11 H16 Z" fill="#172554" stroke="#0f172a" stroke-width="1.4"/>
    <path d="M28 11 L22 46 M38 11 L35 48 M48 11 L51 48 M58 11 L64 46" stroke="#0f172a" stroke-width="1.4"/>`
  ),
  armL: svgCutout(32, 64, animeArm, false),
  armR: svgCutout(32, 64, animeArm, true),
  forearmL: svgCutout(
    28,
    68,
    `<path d="M7 8 Q14 -1 21 8 L19 46 H9 Z" fill="#fde2c8" stroke="#9a6b50" stroke-width="1.5"/>
    <path d="M7 44 H21 L23 58 Q14 66 6 58 Z" fill="#fde2c8" stroke="#9a6b50" stroke-width="1.5"/>`
  ),
  forearmR: svgCutout(
    52,
    76,
    `<path d="M9 8 Q16 -1 23 8 L21 46 H11 Z" fill="#fde2c8" stroke="#9a6b50" stroke-width="1.5"/>
    <rect x="6" y="46" width="42" height="26" rx="4" fill="#78350f" stroke="#451a03" stroke-width="1.6"/>
    <path d="M19 46 V40 Q27 34 35 40 V46" fill="none" stroke="#451a03" stroke-width="2"/>
    <rect x="23" y="54" width="8" height="6" rx="1.5" fill="#fbbf24"/>
    <ellipse cx="16" cy="48" rx="6" ry="5" fill="#fde2c8" stroke="#9a6b50" stroke-width="1.4"/>`
  ),
  thighL: svgCutout(32, 80, animeThigh, false),
  thighR: svgCutout(32, 80, animeThigh, true),
  shinL: svgCutout(38, 90, animeShin, false),
  shinR: svgCutout(38, 90, animeShin, true)
}

// ---------------------------------------------------------------------------
// 3. Toddler / Chibi Kid Cutout Set (7 slots, scale: 0.9)
// ---------------------------------------------------------------------------
const kidArm = `<path d="M6 10 Q16 -2 26 10 L27 34 H5 Z" fill="#f59e0b" stroke="#78350f" stroke-width="1.6"/>
  <path d="M6 22 H26" stroke="#ef4444" stroke-width="4"/>
  <path d="M7 34 H25 L24 58 Q16 68 8 58 Z" fill="#fde2c8" stroke="#9a6b50" stroke-width="1.5"/>
  <circle cx="16" cy="62" r="9" fill="#fde2c8" stroke="#9a6b50" stroke-width="1.5"/>`

const kidLeg = `<path d="M7 8 Q19 -2 31 8 L29 48 H9 Z" fill="#fde2c8" stroke="#9a6b50" stroke-width="1.5"/>
  <rect x="9" y="44" width="20" height="14" fill="#f8fafc" stroke="#64748b" stroke-width="1.4"/>
  <path d="M6 56 H31 L35 72 Q35 80 22 80 H6 Q3 70 6 56 Z" fill="#ef4444" stroke="#7f1d1d" stroke-width="1.6"/>
  <path d="M5 75 H34" stroke="#f8fafc" stroke-width="3.5" stroke-linecap="round"/>`

export const CHIBI_KID_ART = {
  head: svgCutout(
    92,
    94,
    `<rect x="38" y="74" width="16" height="16" rx="6" fill="#fde2c8" stroke="#9a6b50" stroke-width="1.5"/>
    <circle cx="46" cy="48" r="32" fill="#fde2c8" stroke="#9a6b50" stroke-width="1.8"/>
    <circle cx="34" cy="48" r="6" fill="#1e293b"/><circle cx="32" cy="46" r="2.2" fill="#fff"/>
    <circle cx="58" cy="48" r="6" fill="#1e293b"/><circle cx="56" cy="46" r="2.2" fill="#fff"/>
    <ellipse cx="24" cy="56" rx="5.5" ry="3" fill="#fb7185" opacity="0.65"/>
    <ellipse cx="68" cy="56" rx="5.5" ry="3" fill="#fb7185" opacity="0.65"/>
    <path d="M38 60 Q46 68 54 60" fill="#ef4444" stroke="#7f1d1d" stroke-width="1.6"/>
    <path d="M14 36 Q46 20 78 36 L72 24 Q46 14 20 24 Z" fill="#451a03"/>
    <path d="M14 32 Q16 8 46 8 Q76 8 78 32 Z" fill="#2563eb" stroke="#1e3a8a" stroke-width="1.8"/>
    <path d="M56 24 H88 Q90 32 76 34 H56 Z" fill="#ef4444" stroke="#7f1d1d" stroke-width="1.6"/>`
  ),
  torso: svgCutout(
    76,
    68,
    `<path d="M12 8 H64 L66 60 Q38 66 10 60 Z" fill="#fbbf24" stroke="#78350f" stroke-width="1.6"/>
    <path d="M12 22 H64 M11 38 H65 M11 52 H65" stroke="#ef4444" stroke-width="5"/>
    <path d="M20 8 V62 M56 8 V62" stroke="#2563eb" stroke-width="8"/>
    <circle cx="20" cy="42" r="3" fill="#fde047"/><circle cx="56" cy="42" r="3" fill="#fde047"/>`
  ),
  pelvis: svgCutout(
    76,
    50,
    `<path d="M10 4 H66 L70 42 H44 L38 32 L32 42 H6 Z" fill="#2563eb" stroke="#1e3a8a" stroke-width="1.6" stroke-linejoin="round"/>
    <rect x="26" y="12" width="24" height="16" rx="4" fill="#1d4ed8" stroke="#1e3a8a" stroke-width="1.4"/>`
  ),
  armL: svgCutout(32, 74, kidArm, false),
  armR: svgCutout(32, 74, kidArm, true),
  legL: svgCutout(38, 84, kidLeg, false),
  legR: svgCutout(38, 84, kidLeg, true)
}

// ---------------------------------------------------------------------------
// 4. Middle-Aged Businessman Cutout Set (20 slots, scale: 0.95)
// ---------------------------------------------------------------------------
const suitArm = `<path d="M5 10 Q17 -3 29 10 L30 56 Q17 66 4 56 Z" fill="#334155" stroke="#0f172a" stroke-width="1.6"/>`
const suitForearm = `<path d="M5 8 Q15 -2 25 8 L23 48 H7 Z" fill="#334155" stroke="#0f172a" stroke-width="1.6"/>
  <rect x="7" y="46" width="16" height="8" rx="2" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.2"/>`
const suitThigh = `<path d="M5 9 Q18 -3 31 9 L29 74 Q18 84 7 74 Z" fill="#334155" stroke="#0f172a" stroke-width="1.6"/>
  <path d="M18 16 V70" stroke="#475569" stroke-width="1.2"/>`
const suitShin = `<path d="M6 9 Q17 -2 28 9 L26 74 Q17 82 8 74 Z" fill="#334155" stroke="#0f172a" stroke-width="1.6"/>
  <path d="M17 16 V70" stroke="#475569" stroke-width="1.2"/>`
const oxfordShoe = `<path d="M6 6 H28 L30 16 L48 22 Q54 26 50 32 H6 Z" fill="#1e293b" stroke="#020617" stroke-width="1.6"/>
  <path d="M5 31 H51" stroke="#475569" stroke-width="2.5"/>`

export const BUSINESSMAN_ART = {
  head: svgCutout(
    68,
    82,
    `<rect x="26" y="62" width="16" height="16" rx="5" fill="#eab386" stroke="#8c583a" stroke-width="1.5"/>
    <path d="M14 28 Q14 62 34 68 Q54 62 54 28 Q54 10 34 10 Q14 10 14 28 Z" fill="#eab386" stroke="#8c583a" stroke-width="1.6"/>
    <path d="M13 30 Q12 6 35 6 Q56 6 55 30 L50 20 Q34 22 18 18 Z" fill="#475569" stroke="#1e293b" stroke-width="1.5"/>
    <path d="M22 36 H29 M39 36 H46" stroke="#1e293b" stroke-width="2" stroke-linecap="round"/>
    <circle cx="25.5" cy="41" r="2.2" fill="#1e293b"/><circle cx="42.5" cy="41" r="2.2" fill="#1e293b"/>
    <path d="M33 41 L31 49 H36" fill="none" stroke="#8c583a" stroke-width="1.5"/>
    <path d="M27 56 Q34 59 41 56" fill="none" stroke="#7c2d12" stroke-width="1.6"/>`
  ),
  beard: svgCutout(
    46,
    30,
    `<path d="M6 12 Q23 2 40 12 Q34 20 23 18 Q12 20 6 12 Z" fill="#334155" stroke="#0f172a" stroke-width="1.5"/>
    <path d="M14 20 H32 L29 28 Q23 30 17 28 Z" fill="#475569" stroke="#0f172a" stroke-width="1.2"/>`
  ),
  glasses: svgCutout(
    58,
    24,
    `<rect x="5" y="5" width="21" height="13" rx="3" fill="#bae6fd" fill-opacity="0.45" stroke="#d97706" stroke-width="2"/>
    <rect x="32" y="5" width="21" height="13" rx="3" fill="#bae6fd" fill-opacity="0.45" stroke="#d97706" stroke-width="2"/>
    <path d="M26 11 H32 M1 10 H5 M53 10 H57" stroke="#d97706" stroke-width="2"/>`
  ),
  mask: svgCutout(
    52,
    34,
    `<path d="M6 8 Q26 2 46 8 L42 26 Q26 33 10 26 Z" fill="#e2e8f0" stroke="#64748b" stroke-width="1.6"/>
    <path d="M12 14 H40 M14 20 H38" stroke="#94a3b8" stroke-width="1.2"/>`
  ),
  hat: svgCutout(
    86,
    46,
    `<path d="M20 32 L26 10 Q43 4 60 10 L66 32 Z" fill="#1e293b" stroke="#020617" stroke-width="1.6"/>
    <path d="M21 26 H65 V32 H21 Z" fill="#991b1b"/>
    <path d="M4 32 Q43 26 82 32 Q43 40 4 32 Z" fill="#334155" stroke="#020617" stroke-width="1.6"/>`
  ),
  torso: svgCutout(
    84,
    106,
    `<path d="M14 14 L70 14 L74 96 Q42 104 10 96 Z" fill="#334155" stroke="#0f172a" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M28 14 L42 54 L56 14 Z" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.2"/>
    <path d="M39 18 H45 L47 52 L42 62 L37 52 Z" fill="#dc2626" stroke="#7f1d1d" stroke-width="1.2"/>
    <path d="M24 14 L42 56 L60 14" fill="none" stroke="#1e293b" stroke-width="2"/>
    <circle cx="42" cy="68" r="2.5" fill="#0f172a"/><circle cx="42" cy="82" r="2.5" fill="#0f172a"/>`
  ),
  pelvis: svgCutout(
    74,
    42,
    `<path d="M6 4 H68 L70 36 H42 L37 22 L32 36 H4 Z" fill="#334155" stroke="#0f172a" stroke-width="1.6"/>
    <rect x="6" y="4" width="62" height="8" fill="#1c1917"/>
    <rect x="31" y="3" width="12" height="10" rx="2" fill="#fbbf24" stroke="#78350f" stroke-width="1.2"/>`
  ),
  armL: svgCutout(34, 66, suitArm, false),
  armR: svgCutout(34, 66, suitArm, true),
  forearmL: svgCutout(30, 60, suitForearm, false),
  forearmR: svgCutout(30, 60, suitForearm, true),
  handL: svgCutout(
    32,
    44,
    `<rect x="8" y="2" width="16" height="6" rx="2" fill="#fbbf24" stroke="#78350f" stroke-width="1.2"/>
    <path d="M9 8 H23 L25 26 Q16 40 7 26 Z" fill="#eab386" stroke="#8c583a" stroke-width="1.5"/>`
  ),
  handR: svgCutout(
    32,
    44,
    `<path d="M9 6 H23 L25 26 Q16 40 7 26 Z" fill="#eab386" stroke="#8c583a" stroke-width="1.5"/>`
  ),
  briefcase: svgCutout(
    76,
    62,
    `<path d="M28 14 V6 Q38 2 48 6 V14" fill="none" stroke="#451a03" stroke-width="3"/>
    <rect x="6" y="14" width="64" height="44" rx="5" fill="#78350f" stroke="#451a03" stroke-width="2"/>
    <path d="M6 28 H70" stroke="#451a03" stroke-width="2"/>
    <rect x="22" y="25" width="8" height="7" rx="1.5" fill="#fbbf24"/>
    <rect x="46" y="25" width="8" height="7" rx="1.5" fill="#fbbf24"/>`
  ),
  thighL: svgCutout(36, 84, suitThigh, false),
  thighR: svgCutout(36, 84, suitThigh, true),
  shinL: svgCutout(34, 84, suitShin, false),
  shinR: svgCutout(34, 84, suitShin, true),
  footL: svgCutout(56, 36, oxfordShoe, true),
  footR: svgCutout(56, 36, oxfordShoe, false)
}

// ---------------------------------------------------------------------------
// 5. Elderly Grandpa Cutout Set (20 slots, scale: 0.95)
// ---------------------------------------------------------------------------
const robeArm = `<path d="M4 10 Q18 -3 32 10 L34 56 Q18 66 2 56 Z" fill="#78350f" stroke="#451a03" stroke-width="1.6"/>`
const robeForearm = `<path d="M5 8 Q16 -2 27 8 L26 50 Q16 58 6 50 Z" fill="#92400e" stroke="#451a03" stroke-width="1.6"/>`
const robeThigh = `<path d="M5 9 Q18 -3 31 9 L29 74 Q18 84 7 74 Z" fill="#44403c" stroke="#1c1917" stroke-width="1.6"/>`
const robeShin = `<path d="M6 9 Q17 -2 28 9 L25 74 Q17 82 9 74 Z" fill="#e7e5e4" stroke="#57534e" stroke-width="1.5"/>`
const clothShoe = `<path d="M6 8 H28 L48 20 Q52 26 48 31 H6 Z" fill="#292524" stroke="#0c0a09" stroke-width="1.5"/>
  <path d="M5 30 H49" stroke="#f5f5f4" stroke-width="3"/>`

export const GRANDPA_ART = {
  head: svgCutout(
    68,
    82,
    `<rect x="26" y="62" width="16" height="16" rx="5" fill="#e5b887" stroke="#8c583a" stroke-width="1.5"/>
    <path d="M14 28 Q14 62 34 68 Q54 62 54 28 Q54 12 34 12 Q14 12 14 28 Z" fill="#e5b887" stroke="#8c583a" stroke-width="1.6"/>
    <path d="M10 30 Q8 10 34 8 Q60 10 58 30 Q52 18 34 18 Q16 18 10 30 Z" fill="#f1f5f9" stroke="#64748b" stroke-width="1.4"/>
    <path d="M21 35 Q25 32 30 35 M38 35 Q43 32 47 35" fill="none" stroke="#f1f5f9" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="25.5" cy="41" r="2" fill="#1e293b"/><circle cx="42.5" cy="41" r="2" fill="#1e293b"/>
    <path d="M24 27 H44 M26 30 H42" stroke="#b47b56" stroke-width="1" opacity="0.7"/>
    <path d="M28 55 Q34 59 40 55" fill="none" stroke="#7c2d12" stroke-width="1.5"/>`
  ),
  beard: svgCutout(
    58,
    78,
    `<path d="M8 10 Q29 2 50 10 Q54 44 42 66 Q29 76 16 66 Q4 44 8 10 Z" fill="#f8fafc" stroke="#64748b" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M16 14 Q29 24 42 14 M22 30 Q29 52 29 70 M36 30 Q31 52 29 70" fill="none" stroke="#cbd5e1" stroke-width="1.5"/>`
  ),
  glasses: svgCutout(
    54,
    24,
    `<circle cx="16" cy="12" r="8" fill="#e0f2fe" fill-opacity="0.5" stroke="#d97706" stroke-width="2"/>
    <circle cx="38" cy="12" r="8" fill="#e0f2fe" fill-opacity="0.5" stroke="#d97706" stroke-width="2"/>
    <path d="M24 12 H30 M2 11 H8 M46 11 H52" stroke="#d97706" stroke-width="2"/>`
  ),
  mask: svgCutout(
    72,
    44,
    `<path d="M10 8 Q36 16 62 8 L66 26 Q36 34 6 26 Z" fill="#991b1b" stroke="#450a0a" stroke-width="1.6"/>
    <path d="M46 22 L52 42 L62 40 L56 20 Z" fill="#b91c1c" stroke="#450a0a" stroke-width="1.4"/>`
  ),
  hat: svgCutout(
    74,
    46,
    `<path d="M12 34 Q14 8 37 8 Q60 8 62 34 Z" fill="#92400e" stroke="#451a03" stroke-width="1.6"/>
    <rect x="10" y="28" width="54" height="10" rx="4" fill="#78350f" stroke="#451a03" stroke-width="1.5"/>`
  ),
  torso: svgCutout(
    86,
    108,
    `<path d="M14 14 L72 14 L76 98 Q43 106 10 98 Z" fill="#78350f" stroke="#451a03" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M28 14 L43 44 L58 14" fill="#fef3c7" stroke="#451a03" stroke-width="1.5"/>
    <path d="M43 44 V100" stroke="#451a03" stroke-width="2"/>
    <circle cx="43" cy="56" r="2.8" fill="#fbbf24"/><circle cx="43" cy="74" r="2.8" fill="#fbbf24"/>`
  ),
  pelvis: svgCutout(
    76,
    46,
    `<path d="M6 4 H70 L72 40 Q38 45 4 40 Z" fill="#78350f" stroke="#451a03" stroke-width="1.6"/>
    <rect x="6" y="4" width="64" height="10" rx="3" fill="#b45309" stroke="#451a03" stroke-width="1.4"/>`
  ),
  armL: svgCutout(36, 66, robeArm, false),
  armR: svgCutout(36, 66, robeArm, true),
  forearmL: svgCutout(32, 58, robeForearm, false),
  forearmR: svgCutout(32, 58, robeForearm, true),
  handL: svgCutout(
    30,
    40,
    `<path d="M8 6 H22 L24 26 Q15 36 6 26 Z" fill="#e5b887" stroke="#8c583a" stroke-width="1.5"/>`
  ),
  handR: svgCutout(
    30,
    40,
    `<path d="M8 6 H22 L24 26 Q15 36 6 26 Z" fill="#e5b887" stroke="#8c583a" stroke-width="1.5"/>`
  ),
  cane: svgCutout(
    38,
    170,
    `<path d="M10 24 Q10 6 24 6 Q34 6 34 22 V164" fill="none" stroke="#5c3a21" stroke-width="7" stroke-linecap="round"/>
    <path d="M10 24 Q10 6 24 6 Q34 6 34 22 V164" fill="none" stroke="#854d0e" stroke-width="3" stroke-linecap="round"/>`
  ),
  thighL: svgCutout(36, 84, robeThigh, false),
  thighR: svgCutout(36, 84, robeThigh, true),
  shinL: svgCutout(34, 84, robeShin, false),
  shinR: svgCutout(34, 84, robeShin, true),
  footL: svgCutout(54, 34, clothShoe, true),
  footR: svgCutout(54, 34, clothShoe, false)
}
