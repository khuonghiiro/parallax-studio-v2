/**
 * scripts/build-three-scenes-v2.mjs
 * Sinh bộ ảnh Layer SVG chất lượng cao cho 3 khung cảnh:
 *   - Cảnh 1 (0s - 5s): Cánh Đồng Gió Mùa (Khung cảnh Cánh đồng)
 *   - Cảnh 2 (5s - 10s): Phòng Khách Ấm Áp (Khung cảnh Trong nhà)
 *   - Cảnh 3 (10s - 15s): Phố Đêm Đèn Đường (Khung cảnh Ngoài đường)
 * Đồng thời đóng gói Project JSON (`projects/ba-canh-mau-workflow-v2.json`)
 * và bộ Modular Workflow JSON (`projects/workflow-v2-bundle/main.json` + `shots/shot-1..3.json`).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const ASSET_DIR = path.join(ROOT, 'assets', 'scenes-v2')
const PROJ_DIR = path.join(ROOT, 'projects')
const BUNDLE_DIR = path.join(PROJ_DIR, 'workflow-v2-bundle')
const BUNDLE_SHOTS_DIR = path.join(BUNDLE_DIR, 'shots')

fs.mkdirSync(ASSET_DIR, { recursive: true })
fs.mkdirSync(BUNDLE_SHOTS_DIR, { recursive: true })

// ============================================================================
// 1. ĐỊNH NGHĨA 18 FILE ẢNH LAYER SVG CHO 3 KHUNG CẢNH
// ============================================================================
const SVG_ASSETS = [
  // -------------------- CẢNH 1: CÁNH ĐỒNG GIÓ MÙA --------------------
  {
    id: 'asset-s1-sky',
    file: 's1-sky-field.svg',
    name: 'Bầu Trời Hoàng Hôn Cánh Đồng',
    width: 1920,
    height: 1080,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080">
      <defs>
        <linearGradient id="sky1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#1e3a8a"/>
          <stop offset="38%" stop-color="#3b82f6"/>
          <stop offset="72%" stop-color="#f59e0b"/>
          <stop offset="100%" stop-color="#fde68a"/>
        </linearGradient>
        <radialGradient id="sun1" cx="0.72" cy="0.48" r="0.28">
          <stop offset="0%" stop-color="#fffbeb" stop-opacity="1"/>
          <stop offset="35%" stop-color="#fde047" stop-opacity="0.85"/>
          <stop offset="100%" stop-color="#f97316" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="1920" height="1080" fill="url(#sky1)"/>
      <circle cx="1380" cy="520" r="320" fill="url(#sun1)"/>
      <circle cx="1380" cy="520" r="95" fill="#fef9c3" opacity="0.92"/>
      <g fill="#ffffff" opacity="0.55">
        <ellipse cx="420" cy="240" rx="210" ry="44"/>
        <ellipse cx="520" cy="225" rx="140" ry="38"/>
        <ellipse cx="980" cy="180" rx="240" ry="48"/>
        <ellipse cx="1540" cy="260" rx="190" ry="40"/>
      </g>
    </svg>`
  },
  {
    id: 'asset-s1-hills',
    file: 's1-hills-windmill.svg',
    name: 'Đồi Xa & Cối Xay Gió',
    width: 1920,
    height: 680,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 680" width="1920" height="680">
      <defs>
        <linearGradient id="hillFar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#065f46"/>
          <stop offset="100%" stop-color="#047857"/>
        </linearGradient>
        <linearGradient id="hillMid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#10b981"/>
          <stop offset="100%" stop-color="#059669"/>
        </linearGradient>
      </defs>
      <path d="M0,420 Q360,210 780,350 T1520,280 L1920,380 L1920,680 L0,680 Z" fill="url(#hillFar)" opacity="0.9"/>
      <path d="M0,480 Q480,320 960,430 T1920,390 L1920,680 L0,680 Z" fill="url(#hillMid)"/>
      <!-- Cối xay gió trên đồi -->
      <g transform="translate(1420, 170)">
        <polygon points="-28,220 28,220 14,0 -14,0" fill="#f8fafc" stroke="#475569" stroke-width="4"/>
        <path d="M-22,0 Q0,-28 22,0 Z" fill="#dc2626"/>
        <rect x="-10" y="150" width="20" height="42" rx="8" fill="#78350f"/>
        <g stroke="#fef3c7" stroke-width="6">
          <line x1="0" y1="15" x2="-95" y2="-75"/>
          <line x1="0" y1="15" x2="95" y2="105"/>
          <line x1="0" y1="15" x2="95" y2="-75"/>
          <line x1="0" y1="15" x2="-95" y2="105"/>
        </g>
        <circle cx="0" cy="15" r="10" fill="#f59e0b"/>
      </g>
    </svg>`
  },
  {
    id: 'asset-s1-field',
    file: 's1-golden-field.svg',
    name: 'Cánh Đồng Lúa Vàng & Đường Đất',
    width: 1920,
    height: 520,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 520" width="1920" height="520">
      <defs>
        <linearGradient id="meadow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#84cc16"/>
          <stop offset="45%" stop-color="#65a30d"/>
          <stop offset="100%" stop-color="#3f6212"/>
        </linearGradient>
        <linearGradient id="dirtRoad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#d97706"/>
          <stop offset="50%" stop-color="#f59e0b"/>
          <stop offset="100%" stop-color="#b45309"/>
        </linearGradient>
      </defs>
      <path d="M0,110 Q640,50 1280,100 T1920,85 L1920,520 L0,520 Z" fill="url(#meadow)"/>
      <!-- Con đường mòn uốn lượn ngang cánh đồng -->
      <path d="M0,330 Q540,260 1050,315 T1920,280 L1920,410 Q1120,435 560,395 T0,430 Z" fill="url(#dirtRoad)" opacity="0.88"/>
      <!-- Những bông lúa vàng -->
      <g stroke="#fde047" stroke-width="3" fill="none" opacity="0.75">
        <path d="M180,260 Q190,210 205,195 M220,270 Q230,220 245,205 M680,240 Q695,190 710,175 M1240,250 Q1255,200 1270,185 M1620,235 Q1635,185 1650,170"/>
      </g>
    </svg>`
  },
  {
    id: 'asset-s1-oaktree',
    file: 's1-oak-tree.svg',
    name: 'Cây Sồi Cổ Thụ (Vật Cản Z-Index)',
    width: 460,
    height: 560,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 560" width="460" height="560">
      <!-- Bóng đổ dưới gốc cây -->
      <ellipse cx="230" cy="525" rx="135" ry="22" fill="#0f172a" opacity="0.35"/>
      <!-- Thân cây sồi cổ thụ -->
      <path d="M185,525 C195,420 205,330 200,240 L260,240 C255,330 265,420 280,525 Z" fill="#78350f" stroke="#451a03" stroke-width="5"/>
      <path d="M205,300 L130,215 M250,285 L330,205" stroke="#78350f" stroke-width="18" stroke-linecap="round"/>
      <!-- Tán lá xanh rậm nhiều tầng -->
      <circle cx="145" cy="210" r="95" fill="#15803d"/>
      <circle cx="315" cy="210" r="95" fill="#166534"/>
      <circle cx="230" cy="135" r="115" fill="#16a34a"/>
      <circle cx="175" cy="165" r="85" fill="#22c55e" opacity="0.88"/>
      <circle cx="285" cy="160" r="80" fill="#15803d"/>
      <circle cx="230" cy="220" r="92" fill="#16a34a"/>
      <!-- Quả táo đỏ điểm xuyết -->
      <circle cx="170" cy="190" r="9" fill="#ef4444"/>
      <circle cx="275" cy="155" r="9" fill="#ef4444"/>
      <circle cx="225" cy="115" r="9" fill="#ef4444"/>
      <circle cx="295" cy="225" r="9" fill="#ef4444"/>
    </svg>`
  },
  {
    id: 'asset-s1-boy-body',
    file: 's1-boy-body.svg',
    name: 'Cậu Bé Du Hành — Thân & Áo Choàng',
    width: 240,
    height: 340,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 340" width="240" height="340">
      <ellipse cx="120" cy="322" rx="58" ry="14" fill="#0f172a" opacity="0.32"/>
      <!-- Áo choàng xanh -->
      <path d="M72,135 L42,265 L198,265 L168,135 Z" fill="#2563eb" stroke="#1d4ed8" stroke-width="4"/>
      <!-- Chân & Giày -->
      <rect x="88" y="235" width="24" height="72" rx="10" fill="#1e293b"/>
      <rect x="128" y="235" width="24" height="72" rx="10" fill="#1e293b"/>
      <rect x="80" y="295" width="36" height="20" rx="9" fill="#b45309"/>
      <rect x="124" y="295" width="36" height="20" rx="9" fill="#b45309"/>
      <!-- Thân áo vàng cam & Balo -->
      <rect x="74" y="128" width="92" height="116" rx="24" fill="#f59e0b" stroke="#b45309" stroke-width="4"/>
      <rect x="74" y="196" width="92" height="14" fill="#78350f"/>
      <rect x="108" y="193" width="24" height="20" rx="4" fill="#fde047"/>
    </svg>`
  },
  {
    id: 'asset-s1-boy-face-smile',
    file: 's1-boy-face-smile.svg',
    name: 'Khuôn Mặt — Tươi Cười',
    width: 160,
    height: 160,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
      <!-- Mũ rơm phiêu lưu -->
      <ellipse cx="80" cy="48" rx="72" ry="20" fill="#facc15" stroke="#ca8a04" stroke-width="4"/>
      <path d="M32,48 C32,8 128,8 128,48 Z" fill="#fde047" stroke="#ca8a04" stroke-width="4"/>
      <path d="M34,44 L126,44" stroke="#ef4444" stroke-width="8"/>
      <!-- Khuôn mặt -->
      <circle cx="80" cy="86" r="44" fill="#fed7aa" stroke="#ea580c" stroke-width="3"/>
      <!-- Mắt sáng & Nụ cười tươi -->
      <circle cx="64" cy="80" r="6" fill="#0f172a"/>
      <circle cx="96" cy="80" r="6" fill="#0f172a"/>
      <circle cx="62" cy="78" r="2" fill="#ffffff"/>
      <circle cx="94" cy="78" r="2" fill="#ffffff"/>
      <ellipse cx="52" cy="92" rx="7" ry="4" fill="#fb7185" opacity="0.6"/>
      <ellipse cx="108" cy="92" rx="7" ry="4" fill="#fb7185" opacity="0.6"/>
      <path d="M64,98 Q80,114 96,98" fill="none" stroke="#9a3412" stroke-width="4.5" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: 'asset-s1-boy-face-wow',
    file: 's1-boy-face-wow.svg',
    name: 'Khuôn Mặt — Hào Hứng (Wow)',
    width: 160,
    height: 160,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
      <ellipse cx="80" cy="48" rx="72" ry="20" fill="#facc15" stroke="#ca8a04" stroke-width="4"/>
      <path d="M32,48 C32,8 128,8 128,48 Z" fill="#fde047" stroke="#ca8a04" stroke-width="4"/>
      <path d="M34,44 L126,44" stroke="#ef4444" stroke-width="8"/>
      <circle cx="80" cy="86" r="44" fill="#fed7aa" stroke="#ea580c" stroke-width="3"/>
      <!-- Mắt ngôi sao hào hứng & Miệng chữ O -->
      <circle cx="63" cy="78" r="8" fill="#0f172a"/>
      <circle cx="97" cy="78" r="8" fill="#0f172a"/>
      <circle cx="60" cy="75" r="3" fill="#fde047"/>
      <circle cx="94" cy="75" r="3" fill="#fde047"/>
      <ellipse cx="80" cy="103" rx="11" ry="13" fill="#ef4444" stroke="#7f1d1d" stroke-width="3"/>
    </svg>`
  },
  {
    id: 'asset-s1-boy-arm-wave',
    file: 's1-boy-arm-wave.svg',
    name: 'Tay Phải — Vẫy Chào',
    width: 150,
    height: 180,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 180" width="150" height="180">
      <path d="M30,130 Q75,85 110,38" fill="none" stroke="#f59e0b" stroke-width="24" stroke-linecap="round"/>
      <circle cx="114" cy="34" r="16" fill="#fed7aa" stroke="#ea580c" stroke-width="3"/>
    </svg>`
  },
  {
    id: 'asset-s1-boy-arm-point',
    file: 's1-boy-arm-point.svg',
    name: 'Tay Phải — Cầm Chong Chóng Tre',
    width: 150,
    height: 180,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 180" width="150" height="180">
      <path d="M26,122 L116,78" fill="none" stroke="#f59e0b" stroke-width="24" stroke-linecap="round"/>
      <circle cx="118" cy="76" r="15" fill="#fed7aa" stroke="#ea580c" stroke-width="3"/>
      <!-- Chong chóng gió cầm tay -->
      <line x1="122" y1="76" x2="122" y2="22" stroke="#78350f" stroke-width="5"/>
      <circle cx="122" cy="24" r="18" fill="#38bdf8" opacity="0.85"/>
      <circle cx="122" cy="24" r="5" fill="#f43f5e"/>
    </svg>`
  },
  {
    id: 'asset-s1-fg-flowers',
    file: 's1-fg-flowers.svg',
    name: 'Hoa Bồ Công Anh Tiền Cảnh',
    width: 1920,
    height: 320,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 320" width="1920" height="320">
      <path d="M0,210 Q480,150 960,215 T1920,185 L1920,320 L0,320 Z" fill="#14532d" opacity="0.92"/>
      <g fill="#fde047">
        <circle cx="210" cy="190" r="16"/>
        <circle cx="340" cy="220" r="14"/>
        <circle cx="1540" cy="195" r="18"/>
        <circle cx="1720" cy="215" r="15"/>
      </g>
      <g fill="#f472b6">
        <circle cx="280" cy="205" r="13"/>
        <circle cx="1630" cy="210" r="14"/>
      </g>
    </svg>`
  },

  // -------------------- CẢNH 2: PHÒNG KHÁCH ẤM ÁP --------------------
  {
    id: 'asset-s2-room-wall',
    file: 's2-room-wall-window.svg',
    name: 'Tường Gỗ & Cửa Sổ Đêm Trăng',
    width: 1920,
    height: 1080,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080">
      <defs>
        <linearGradient id="wall2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#312e81"/>
          <stop offset="68%" stop-color="#4338ca"/>
          <stop offset="69%" stop-color="#78350f"/>
          <stop offset="100%" stop-color="#451a03"/>
        </linearGradient>
      </defs>
      <rect width="1920" height="1080" fill="url(#wall2)"/>
      <!-- Cửa sổ nhìn ra bầu trời đêm trăng -->
      <rect x="720" y="120" width="480" height="420" rx="18" fill="#0f172a" stroke="#d97706" stroke-width="16"/>
      <circle cx="1060" cy="230" r="46" fill="#fef08a"/>
      <circle cx="820" cy="200" r="4" fill="#ffffff"/>
      <circle cx="910" cy="280" r="3" fill="#ffffff"/>
      <circle cx="860" cy="360" r="4" fill="#ffffff"/>
      <line x1="960" y1="120" x2="960" y2="540" stroke="#d97706" stroke-width="12"/>
      <line x1="720" y1="330" x2="1200" y2="330" stroke="#d97706" stroke-width="12"/>
      <!-- Thảm trải sàn ấm áp -->
      <ellipse cx="960" cy="910" rx="640" ry="110" fill="#991b1b" stroke="#f59e0b" stroke-width="8"/>
    </svg>`
  },
  {
    id: 'asset-s2-bookshelf',
    file: 's2-bookshelf-sofa.svg',
    name: 'Kệ Sách Gỗ & Ghế Sofa',
    width: 1700,
    height: 700,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1700 700" width="1700" height="700">
      <!-- Kệ sách bên trái -->
      <rect x="90" y="60" width="320" height="540" rx="10" fill="#78350f" stroke="#451a03" stroke-width="8"/>
      <rect x="115" y="90" width="270" height="110" fill="#451a03"/>
      <rect x="115" y="225" width="270" height="110" fill="#451a03"/>
      <rect x="115" y="360" width="270" height="110" fill="#451a03"/>
      <!-- Những cuốn sách nhiều màu -->
      <rect x="130" y="110" width="26" height="88" fill="#ef4444"/>
      <rect x="160" y="118" width="28" height="80" fill="#3b82f6"/>
      <rect x="192" y="105" width="24" height="93" fill="#10b981"/>
      <rect x="222" y="115" width="30" height="83" fill="#f59e0b"/>
      <rect x="140" y="245" width="32" height="88" fill="#8b5cf6"/>
      <rect x="176" y="250" width="26" height="83" fill="#ec4899"/>
      <!-- Ghế Sofa êm ái -->
      <rect x="540" y="360" width="660" height="210" rx="42" fill="#0d9488" stroke="#115e59" stroke-width="6"/>
      <rect x="500" y="430" width="740" height="160" rx="32" fill="#14b8a6" stroke="#0f766e" stroke-width="6"/>
      <rect x="590" y="395" width="110" height="90" rx="20" fill="#fde047" transform="rotate(-8 645 440)"/>
    </svg>`
  },
  {
    id: 'asset-s2-lamp-table',
    file: 's2-tea-table-lamp.svg',
    name: 'Bàn Trà & Đèn Bàn Toả Sáng',
    width: 520,
    height: 460,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 460" width="520" height="460">
      <defs>
        <radialGradient id="lampGlow" cx="0.5" cy="0.32" r="0.45">
          <stop offset="0%" stop-color="#fef08a" stop-opacity="0.95"/>
          <stop offset="55%" stop-color="#f59e0b" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#f59e0b" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="260" cy="150" r="190" fill="url(#lampGlow)"/>
      <!-- Mặt bàn gỗ -->
      <rect x="70" y="280" width="380" height="32" rx="12" fill="#b45309" stroke="#78350f" stroke-width="4"/>
      <rect x="115" y="312" width="26" height="125" rx="6" fill="#78350f"/>
      <rect x="379" y="312" width="26" height="125" rx="6" fill="#78350f"/>
      <!-- Đèn bàn vàng ấm -->
      <rect x="235" y="255" width="50" height="25" rx="6" fill="#475569"/>
      <line x1="260" y1="165" x2="260" y2="255" stroke="#94a3b8" stroke-width="10"/>
      <polygon points="195,175 325,175 295,85 225,85" fill="#fde047" stroke="#d97706" stroke-width="5"/>
    </svg>`
  },
  {
    id: 'asset-s2-robo-body',
    file: 's2-robo-body.svg',
    name: 'Mèo Máy Quản Gia — Thân Máy',
    width: 240,
    height: 320,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 320" width="240" height="320">
      <ellipse cx="120" cy="302" rx="64" ry="14" fill="#0f172a" opacity="0.35"/>
      <!-- Bánh xe lướt -->
      <circle cx="92" cy="285" r="20" fill="#1e293b" stroke="#38bdf8" stroke-width="4"/>
      <circle cx="148" cy="285" r="20" fill="#1e293b" stroke="#38bdf8" stroke-width="4"/>
      <!-- Thân robot bo tròn -->
      <rect x="56" y="132" width="128" height="142" rx="38" fill="#e2e8f0" stroke="#0284c7" stroke-width="5"/>
      <circle cx="120" cy="198" r="28" fill="#38bdf8" stroke="#0369a1" stroke-width="4"/>
      <!-- Chuông vàng cổ mèo máy -->
      <rect x="72" y="124" width="96" height="14" rx="7" fill="#ef4444"/>
      <circle cx="120" cy="134" r="12" fill="#facc15" stroke="#b45309" stroke-width="3"/>
    </svg>`
  },
  {
    id: 'asset-s2-robo-face-happy',
    file: 's2-robo-face-happy.svg',
    name: 'Màn Hình Mặt — Mắt Cười',
    width: 160,
    height: 150,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 150" width="160" height="150">
      <!-- Đôi tai mèo -->
      <polygon points="28,55 42,10 72,42" fill="#38bdf8" stroke="#0284c7" stroke-width="4"/>
      <polygon points="132,55 118,10 88,42" fill="#38bdf8" stroke="#0284c7" stroke-width="4"/>
      <!-- Đầu & Màn hình LED -->
      <rect x="22" y="34" width="116" height="96" rx="32" fill="#f8fafc" stroke="#0284c7" stroke-width="5"/>
      <rect x="36" y="48" width="88" height="68" rx="20" fill="#0f172a"/>
      <path d="M50,78 Q62,64 74,78" fill="none" stroke="#38bdf8" stroke-width="5" stroke-linecap="round"/>
      <path d="M86,78 Q98,64 110,78" fill="none" stroke="#38bdf8" stroke-width="5" stroke-linecap="round"/>
      <path d="M64,96 Q80,108 96,96" fill="none" stroke="#4ade80" stroke-width="4" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: 'asset-s2-robo-face-talk',
    file: 's2-robo-face-talk.svg',
    name: 'Màn Hình Mặt — Đang Nói',
    width: 160,
    height: 150,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 150" width="160" height="150">
      <polygon points="28,55 42,10 72,42" fill="#38bdf8" stroke="#0284c7" stroke-width="4"/>
      <polygon points="132,55 118,10 88,42" fill="#38bdf8" stroke="#0284c7" stroke-width="4"/>
      <rect x="22" y="34" width="116" height="96" rx="32" fill="#f8fafc" stroke="#0284c7" stroke-width="5"/>
      <rect x="36" y="48" width="88" height="68" rx="20" fill="#0f172a"/>
      <circle cx="62" cy="74" r="8" fill="#38bdf8"/>
      <circle cx="98" cy="74" r="8" fill="#38bdf8"/>
      <!-- Sóng âm miệng đang nói -->
      <rect x="58" y="92" width="44" height="14" rx="7" fill="#f43f5e"/>
    </svg>`
  },
  {
    id: 'asset-s2-tea-tray',
    file: 's2-tea-tray-prop.svg',
    name: 'Khay Trà Nóng (Đạo Cụ Gắn Cụm)',
    width: 160,
    height: 120,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120" width="160" height="120">
      <ellipse cx="80" cy="92" rx="68" ry="14" fill="#d97706" stroke="#78350f" stroke-width="4"/>
      <!-- Ấm trà & tách trà bốc khói -->
      <circle cx="66" cy="68" r="22" fill="#f8fafc" stroke="#64748b" stroke-width="3"/>
      <path d="M88,68 Q104,58 106,48" fill="none" stroke="#f8fafc" stroke-width="6" stroke-linecap="round"/>
      <rect x="108" y="66" width="24" height="22" rx="5" fill="#fef08a" stroke="#ca8a04" stroke-width="3"/>
      <path d="M66,36 Q60,22 70,12 M118,54 Q114,40 122,30" fill="none" stroke="#e2e8f0" stroke-width="3" stroke-linecap="round" opacity="0.8"/>
    </svg>`
  },

  // -------------------- CẢNH 3: PHỐ ĐÊM ĐÈN ĐƯỜNG --------------------
  {
    id: 'asset-s3-city-sky',
    file: 's3-city-night-sky.svg',
    name: 'Bầu Trời Phố Đêm & Tòa Nhà Xa',
    width: 1920,
    height: 1080,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080">
      <defs>
        <linearGradient id="night3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#090d16"/>
          <stop offset="55%" stop-color="#1e1b4b"/>
          <stop offset="100%" stop-color="#311042"/>
        </linearGradient>
      </defs>
      <rect width="1920" height="1080" fill="url(#night3)"/>
      <!-- Skyline tòa nhà thành phố -->
      <g fill="#0f172a" stroke="#334155" stroke-width="2">
        <rect x="80" y="260" width="190" height="620"/>
        <rect x="310" y="180" width="220" height="700"/>
        <rect x="570" y="310" width="180" height="570"/>
        <rect x="810" y="150" width="260" height="730"/>
        <rect x="1120" y="240" width="210" height="640"/>
        <rect x="1380" y="190" width="240" height="690"/>
        <rect x="1660" y="280" width="190" height="600"/>
      </g>
      <!-- Ô cửa sổ sáng đèn -->
      <g fill="#fde047" opacity="0.8">
        <rect x="350" y="230" width="28" height="36"/>
        <rect x="410" y="230" width="28" height="36"/>
        <rect x="350" y="300" width="28" height="36"/>
        <rect x="860" y="210" width="32" height="40"/>
        <rect x="930" y="210" width="32" height="40"/>
        <rect x="860" y="280" width="32" height="40"/>
        <rect x="1430" y="250" width="30" height="38"/>
        <rect x="1500" y="320" width="30" height="38"/>
      </g>
    </svg>`
  },
  {
    id: 'asset-s3-street-road',
    file: 's3-street-road.svg',
    name: 'Mặt Đường Nhựa & Vỉa Hè Phố Đêm',
    width: 1920,
    height: 540,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 540" width="1920" height="540">
      <!-- Vỉa hè lát gạch -->
      <rect x="0" y="80" width="1920" height="130" fill="#334155"/>
      <line x1="0" y1="210" x2="1920" y2="210" stroke="#94a3b8" stroke-width="8"/>
      <!-- Lòng đường nhựa -->
      <rect x="0" y="210" width="1920" height="330" fill="#1e293b"/>
      <!-- Vạch kẻ phân làn phát sáng -->
      <g fill="#facc15">
        <rect x="120" y="360" width="180" height="18" rx="6"/>
        <rect x="480" y="360" width="180" height="18" rx="6"/>
        <rect x="840" y="360" width="180" height="18" rx="6"/>
        <rect x="1200" y="360" width="180" height="18" rx="6"/>
        <rect x="1560" y="360" width="180" height="18" rx="6"/>
      </g>
    </svg>`
  },
  {
    id: 'asset-s3-lamp-tree',
    file: 's3-street-lamp-tree.svg',
    name: 'Cột Đèn Đường Neon & Cây Vỉa Hè',
    width: 420,
    height: 620,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 620" width="420" height="620">
      <defs>
        <radialGradient id="streetGlow" cx="0.65" cy="0.22" r="0.45">
          <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.9"/>
          <stop offset="50%" stop-color="#38bdf8" stop-opacity="0.28"/>
          <stop offset="100%" stop-color="#38bdf8" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="275" cy="135" r="175" fill="url(#streetGlow)"/>
      <!-- Cây xanh vỉa hè -->
      <rect x="105" y="340" width="34" height="240" rx="8" fill="#5c2d16"/>
      <circle cx="122" cy="270" r="88" fill="#065f46"/>
      <circle cx="95" cy="240" r="65" fill="#10b981" opacity="0.85"/>
      <!-- Cột đèn đường cao -->
      <rect x="210" y="560" width="44" height="24" rx="6" fill="#475569"/>
      <path d="M232,560 L232,125 Q232,85 280,85 L315,85" fill="none" stroke="#94a3b8" stroke-width="14" stroke-linecap="round"/>
      <ellipse cx="305" cy="96" rx="32" ry="12" fill="#e0f2fe" stroke="#0284c7" stroke-width="4"/>
    </svg>`
  },
  {
    id: 'asset-s3-crate',
    file: 's3-street-crate.svg',
    name: 'Thùng Hàng & Biển Báo Vỉa Hè (Mục Tiêu Va Chạm)',
    width: 240,
    height: 220,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 220" width="240" height="220">
      <ellipse cx="120" cy="202" rx="85" ry="14" fill="#0f172a" opacity="0.45"/>
      <!-- Thùng gỗ kiện hàng -->
      <rect x="34" y="74" width="124" height="124" rx="10" fill="#d97706" stroke="#78350f" stroke-width="6"/>
      <line x1="34" y1="74" x2="158" y2="198" stroke="#92400e" stroke-width="6"/>
      <line x1="158" y1="74" x2="34" y2="198" stroke="#92400e" stroke-width="6"/>
      <!-- Chóp nón giao thông phản quang -->
      <polygon points="150,198 216,198 192,92 174,92" fill="#f97316" stroke="#c2410c" stroke-width="4"/>
      <polygon points="164,152 202,152 197,128 169,128" fill="#f8fafc"/>
    </svg>`
  },
  {
    id: 'asset-s3-scooter',
    file: 's3-scooter-rider.svg',
    name: 'Tay Đua Scooter Điện',
    width: 300,
    height: 320,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 320" width="300" height="320">
      <ellipse cx="150" cy="298" rx="95" ry="14" fill="#0f172a" opacity="0.4"/>
      <!-- Bánh xe Scooter phát sáng Neon -->
      <circle cx="78" cy="268" r="28" fill="#0f172a" stroke="#22d3ee" stroke-width="7"/>
      <circle cx="222" cy="268" r="28" fill="#0f172a" stroke="#22d3ee" stroke-width="7"/>
      <!-- Khung xe Scooter -->
      <path d="M78,268 L195,268 L228,132 L202,126" fill="none" stroke="#f43f5e" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
      <!-- Đèn pha trước -->
      <circle cx="232" cy="148" r="10" fill="#fef08a"/>
      <!-- Nhân vật đội mũ bảo hiểm -->
      <rect x="112" y="128" width="56" height="92" rx="20" fill="#8b5cf6" stroke="#5b21b6" stroke-width="4"/>
      <line x1="156" y1="150" x2="216" y2="132" stroke="#c4b5fd" stroke-width="14" stroke-linecap="round"/>
      <line x1="132" y1="215" x2="138" y2="262" stroke="#1e293b" stroke-width="16" stroke-linecap="round"/>
      <circle cx="144" cy="92" r="34" fill="#38bdf8" stroke="#0284c7" stroke-width="4"/>
      <path d="M148,78 L178,78 Q182,92 174,102 L148,102 Z" fill="#0f172a"/>
    </svg>`
  }
]

for (const item of SVG_ASSETS) {
  const outPath = path.join(ASSET_DIR, item.file)
  fs.writeFileSync(outPath, item.svg.trim(), 'utf8')
  const b64 = Buffer.from(item.svg.trim(), 'utf8').toString('base64')
  item.dataUrl = `data:image/svg+xml;base64,${b64}`
}

console.log(`[build-three-scenes-v2] ✓ Đã tạo ${SVG_ASSETS.length} file SVG layer tại assets/scenes-v2/`)
