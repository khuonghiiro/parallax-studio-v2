import { COTTAGE_THUMBNAIL } from './cottageThumbnail'

// Isometric 3D Cube Box SVG Data URL
export const CUBE_THUMBNAIL = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 280" width="400" height="280">
  <defs>
    <linearGradient id="topG" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fb923c"/>
      <stop offset="100%" stop-color="#ea580c"/>
    </linearGradient>
    <linearGradient id="leftG" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#0284c7"/>
    </linearGradient>
    <linearGradient id="rightG" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#818cf8"/>
      <stop offset="100%" stop-color="#4f46e5"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000" flood-opacity="0.35"/>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="#0e131f"/>
  <g filter="url(#shadow)">
    <!-- Top Face -->
    <polygon points="200,45 315,105 200,165 85,105" fill="url(#topG)" stroke="#fed7aa" stroke-width="2"/>
    <!-- Left Face -->
    <polygon points="85,105 200,165 200,245 85,185" fill="url(#leftG)" stroke="#bae6fd" stroke-width="2"/>
    <!-- Right Face -->
    <polygon points="200,165 315,105 315,185 200,245" fill="url(#rightG)" stroke="#c7d2fe" stroke-width="2"/>
  </g>
  <text x="200" y="112" font-family="sans-serif" font-size="13" font-weight="bold" fill="#ffffff" text-anchor="middle">NẮP TRÊN</text>
  <text x="142" y="180" font-family="sans-serif" font-size="12" font-weight="bold" fill="#ffffff" text-anchor="middle">HÔNG TRÁI</text>
  <text x="258" y="180" font-family="sans-serif" font-size="12" font-weight="bold" fill="#ffffff" text-anchor="middle">MẶT TRƯỚC</text>
</svg>
`)}`

// Isometric L-Corner Street Facade SVG Data URL
export const CORNER_THUMBNAIL = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 280" width="400" height="280">
  <defs>
    <linearGradient id="groundG" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#334155"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="wallFront" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#1d4ed8"/>
    </linearGradient>
    <linearGradient id="wallSide" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0284c7"/>
      <stop offset="100%" stop-color="#0369a1"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="#0e131f"/>
  <!-- Sidewalk Ground -->
  <polygon points="200,160 360,225 200,270 40,205" fill="url(#groundG)" stroke="#64748b" stroke-width="1.5"/>
  <!-- Left Alley Wall (bẻ góc 90 độ) -->
  <polygon points="70,55 200,120 200,215 70,150" fill="url(#wallSide)" stroke="#7dd3fc" stroke-width="2"/>
  <!-- Main Facade Wall -->
  <polygon points="200,120 330,55 330,150 200,215" fill="url(#wallFront)" stroke="#93c5fd" stroke-width="2"/>
  <!-- Windows & Door Details -->
  <rect x="110" y="90" width="22" height="30" rx="3" fill="#bae6fd" opacity="0.8" transform="skewY(24)"/>
  <rect x="268" y="-30" width="22" height="30" rx="3" fill="#bae6fd" opacity="0.8" transform="skewY(-24)"/>
  <path d="M 200 120 L 200 215" stroke="#facc15" stroke-width="3"/>
  <text x="200" y="245" font-family="sans-serif" font-size="12" font-weight="bold" fill="#facc15" text-anchor="middle">GÓC BẺ VUÔNG 90°</text>
</svg>
`)}`

// Isometric Open Room Interior SVG Data URL
export const ROOM_THUMBNAIL = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 280" width="400" height="280">
  <defs>
    <linearGradient id="rFloor" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#475569"/>
      <stop offset="100%" stop-color="#334155"/>
    </linearGradient>
    <linearGradient id="rBack" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="#0e131f"/>
  <!-- Floor -->
  <polygon points="200,140 330,200 200,255 70,200" fill="url(#rFloor)" stroke="#64748b" stroke-width="2"/>
  <!-- Back Wall -->
  <polygon points="70,80 330,80 330,200 70,200" fill="url(#rBack)" stroke="#475569" stroke-width="1.5" opacity="0.6"/>
  <!-- Left Wall -->
  <polygon points="70,40 200,100 200,200 70,140" fill="#334155" stroke="#64748b" stroke-width="2"/>
  <!-- Right Wall -->
  <polygon points="200,100 330,40 330,140 200,200" fill="#1e293b" stroke="#64748b" stroke-width="2"/>
  <!-- Ceiling Wireframe Outline -->
  <polygon points="200,40 330,100 200,160 70,100" fill="none" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="4 4"/>
  <text x="200" y="160" font-family="sans-serif" font-size="12" font-weight="bold" fill="#38bdf8" text-anchor="middle">KHÔNG GIAN NỘI THẤT</text>
</svg>
`)}`

export { COTTAGE_THUMBNAIL }
