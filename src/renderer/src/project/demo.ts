import type { Layer, Project, Vec3 } from '@shared/types'
import { addKeyframe } from '../animation/keyframes'
import { mulberry32, referenceDistance } from '../animation/math'
import { buildCameraPath } from '../animation/cameraPath'
import { assetStore } from './assets'
import { createImageLayer, createParticleLayer, createProject, createShot, createTextLayer, shotSpacing } from './factory'

/**
 * Builds a procedural twilight landscape (transparent PNG plates drawn on canvas)
 * so the app opens with a fully animated parallax scene.
 *
 * v2: three shots laid out side by side in 3D space (Twilight Valley → Northern
 * Lights → Golden Dunes) with a camera tour flying between them.
 */

const W = 2700
const H = 1520

function valueNoise1D(seed: number): (x: number) => number {
  const rand = mulberry32(seed)
  const lattice = Array.from({ length: 512 }, () => rand())
  return (x: number) => {
    const i = Math.floor(x)
    const f = x - i
    const a = lattice[((i % 512) + 512) % 512]
    const b = lattice[(((i + 1) % 512) + 512) % 512]
    const u = (1 - Math.cos(f * Math.PI)) / 2
    return a * (1 - u) + b * u
  }
}

function fbm(noise: (x: number) => number, x: number, octaves = 5): number {
  let v = 0
  let amp = 0.5
  let freq = 1
  for (let i = 0; i < octaves; i++) {
    v += noise(x * freq) * amp
    freq *= 2.1
    amp *= 0.5
  }
  return v
}

function canvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  return [c, c.getContext('2d')!]
}

interface SkyOpts {
  stops: [number, string][]
  stars: number
  starSeed: number
  /** Sun position as fractions of the plate, or null for no sun. */
  sun: { x: number; y: number; r: number; core: string; glow: string } | null
}

function drawSky(o: SkyOpts): HTMLCanvasElement {
  const [c, ctx] = canvas()
  const g = ctx.createLinearGradient(0, 0, 0, H)
  for (const [at, col] of o.stops) g.addColorStop(at, col)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  const rand = mulberry32(o.starSeed)
  for (let i = 0; i < o.stars; i++) {
    const x = rand() * W
    const y = Math.pow(rand(), 1.6) * H * 0.55
    const r = rand() * 1.6 + 0.3
    ctx.globalAlpha = 0.25 + rand() * 0.75 * (1 - y / (H * 0.55))
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  if (o.sun) {
    // Setting sun with soft glow.
    const sx = W * o.sun.x
    const sy = H * o.sun.y
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, H * 0.6)
    glow.addColorStop(0, `rgba(${o.sun.glow},0.95)`)
    glow.addColorStop(0.08, `rgba(${o.sun.glow},0.7)`)
    glow.addColorStop(0.3, `rgba(${o.sun.glow},0.22)`)
    glow.addColorStop(1, `rgba(${o.sun.glow},0)`)
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = o.sun.core
    ctx.beginPath()
    ctx.arc(sx, sy, o.sun.r, 0, Math.PI * 2)
    ctx.fill()
  }
  return c
}

/** Polar night sky with layered aurora curtains. */
function drawAuroraSky(): HTMLCanvasElement {
  const c = drawSky({
    stops: [
      [0, '#01040d'],
      [0.45, '#06182a'],
      [0.75, '#0c3442'],
      [1, '#1b5a5e']
    ],
    stars: 1300,
    starSeed: 13,
    sun: null
  })
  const ctx = c.getContext('2d')!
  ctx.globalCompositeOperation = 'lighter'
  const bands = [
    { y: 0.36, amp: 120, rgb: '90,255,180', seed: 3, freq: 2.2, h: 300, a: 0.16 },
    { y: 0.3, amp: 90, rgb: '80,210,255', seed: 9, freq: 3.1, h: 240, a: 0.12 },
    { y: 0.22, amp: 70, rgb: '190,120,255', seed: 17, freq: 1.7, h: 200, a: 0.09 }
  ]
  for (const b of bands) {
    const curve = valueNoise1D(b.seed)
    const height = valueNoise1D(b.seed * 7 + 1)
    for (let x = 0; x < W; x += 3) {
      const u = x / W
      const yb = H * b.y + (fbm(curve, u * b.freq, 4) - 0.5) * 2 * b.amp
      const hh = b.h * (0.45 + height(u * 14) * 0.9)
      const g = ctx.createLinearGradient(0, yb - hh, 0, yb + 12)
      g.addColorStop(0, `rgba(${b.rgb},0)`)
      g.addColorStop(0.82, `rgba(${b.rgb},${b.a})`)
      g.addColorStop(1, `rgba(${b.rgb},0)`)
      ctx.fillStyle = g
      ctx.fillRect(x, yb - hh, 3, hh + 12)
    }
  }
  // Faint teal horizon glow.
  const hz = ctx.createLinearGradient(0, H * 0.55, 0, H)
  hz.addColorStop(0, 'rgba(60,200,180,0)')
  hz.addColorStop(1, 'rgba(60,200,180,0.18)')
  ctx.fillStyle = hz
  ctx.fillRect(0, 0, W, H)
  ctx.globalCompositeOperation = 'source-over'
  return c
}

interface RidgeOpts {
  seed: number
  base: number // 0..1 of height
  amp: number // px
  freq: number
  top: string
  bottom: string
  /** fbm octaves: fewer = smoother silhouettes (dunes), more = jagged (rocks). */
  octaves?: number
  trees?: { density: number; minH: number; maxH: number; color: string; sides?: boolean }
  mist?: string
}

function drawRidge(o: RidgeOpts): HTMLCanvasElement {
  const [c, ctx] = canvas()
  const noise = valueNoise1D(o.seed)
  const ridgeY = (x: number): number => H * o.base - (fbm(noise, (x / W) * o.freq, o.octaves) - 0.5) * 2 * o.amp

  ctx.beginPath()
  ctx.moveTo(0, H)
  for (let x = 0; x <= W; x += 4) ctx.lineTo(x, ridgeY(x))
  ctx.lineTo(W, H)
  ctx.closePath()
  const g = ctx.createLinearGradient(0, H * o.base - o.amp, 0, H)
  g.addColorStop(0, o.top)
  g.addColorStop(1, o.bottom)
  ctx.fillStyle = g
  ctx.fill()

  if (o.trees) {
    const rand = mulberry32(o.seed * 31 + 5)
    const t = o.trees
    ctx.fillStyle = t.color
    for (let x = -20; x < W + 20; x += 6 + rand() * 40 / t.density) {
      if (t.sides) {
        // Frame the shot: big trees only near the left/right edges.
        const edge = Math.min(x, W - x) / W
        if (edge > 0.2) continue
      }
      const h = t.minH + rand() * (t.maxH - t.minH)
      const baseY = ridgeY(Math.max(0, Math.min(W, x))) + h * 0.05
      const wdt = h * (0.28 + rand() * 0.1)
      const tiers = 4
      for (let k = 0; k < tiers; k++) {
        const ty = baseY - (h * k) / tiers
        const tw = wdt * (1 - k / (tiers + 0.6))
        ctx.beginPath()
        ctx.moveTo(x - tw, ty)
        ctx.lineTo(x, ty - h / tiers - h * 0.25)
        ctx.lineTo(x + tw, ty)
        ctx.closePath()
        ctx.fill()
      }
      ctx.fillRect(x - wdt * 0.06, baseY - h * 0.05, wdt * 0.12, h * 0.15)
    }
  }

  if (o.mist) {
    ctx.globalCompositeOperation = 'source-atop'
    const m = ctx.createLinearGradient(0, H * o.base, 0, H)
    m.addColorStop(0, 'rgba(0,0,0,0)')
    m.addColorStop(1, o.mist)
    ctx.fillStyle = m
    ctx.fillRect(0, 0, W, H)
    ctx.globalCompositeOperation = 'source-over'
  }
  return c
}

interface GroundOpts {
  nearColor: string
  farColor: string
  gridColor?: string
  mistColor?: string
}

function drawGround(o: GroundOpts): HTMLCanvasElement {
  const [c, ctx] = canvas()
  // In a plane rotated -90deg on X:
  // y = 0 is near camera (foreground), y = H is far horizon (background).
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, o.nearColor)
  g.addColorStop(0.65, o.farColor)
  g.addColorStop(1, o.mistColor ?? o.farColor)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // Orthogonal grid lines: in 3D perspective, the camera naturally converges them to the vanishing point!
  ctx.strokeStyle = o.gridColor ?? 'rgba(255, 255, 255, 0.08)'
  ctx.lineWidth = 1.5
  for (let x = 0; x <= W; x += 120) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, H)
    ctx.stroke()
  }
  for (let y = 0; y <= H; y += 100) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
  }
  return c
}

// ------------------------------------------------------------------ Verdant Valley (3D Ground, Orchard & Flora)

function drawMorningSky(): HTMLCanvasElement {
  const [c, ctx] = canvas()
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#0f2744')
  g.addColorStop(0.28, '#1e4b75')
  g.addColorStop(0.52, '#3f749a')
  g.addColorStop(0.72, '#f49466')
  g.addColorStop(0.86, '#fcae55')
  g.addColorStop(1.0, '#ffeec7')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // Rising morning sun with radiant corona and god rays
  const sx = W * 0.68
  const sy = H * 0.54
  const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, H * 0.75)
  glow.addColorStop(0, 'rgba(255, 248, 220, 0.95)')
  glow.addColorStop(0.12, 'rgba(255, 215, 140, 0.65)')
  glow.addColorStop(0.35, 'rgba(255, 175, 95, 0.22)')
  glow.addColorStop(1, 'rgba(255, 160, 80, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  // Sun disc
  ctx.fillStyle = '#fffdf6'
  ctx.beginPath()
  ctx.arc(sx, sy, 82, 0, Math.PI * 2)
  ctx.fill()

  // God rays (translucent morning sunbeams streaming down)
  ctx.globalCompositeOperation = 'lighter'
  const beamAngles = [0.85, 1.05, 1.25, 1.45, 1.7, 1.95, 2.15]
  for (const ang of beamAngles) {
    const spread = 0.08
    const dist = H * 1.5
    ctx.beginPath()
    ctx.moveTo(sx, sy)
    ctx.lineTo(sx + Math.cos(ang - spread) * dist, sy + Math.sin(ang - spread) * dist)
    ctx.lineTo(sx + Math.cos(ang + spread) * dist, sy + Math.sin(ang + spread) * dist)
    ctx.closePath()
    const rg = ctx.createRadialGradient(sx, sy, 50, sx, sy, dist)
    rg.addColorStop(0, 'rgba(255, 240, 190, 0.16)')
    rg.addColorStop(0.6, 'rgba(255, 210, 140, 0.07)')
    rg.addColorStop(1, 'rgba(255, 180, 100, 0)')
    ctx.fillStyle = rg
    ctx.fill()
  }
  ctx.globalCompositeOperation = 'source-over'

  // Soft morning clouds
  const clouds = [
    { x: 0.18, y: 0.38, w: 520, h: 55, a: 0.35 },
    { x: 0.42, y: 0.28, w: 680, h: 65, a: 0.28 },
    { x: 0.78, y: 0.42, w: 480, h: 48, a: 0.4 }
  ]
  for (const cl of clouds) {
    const cx = W * cl.x
    const cy = H * cl.y
    const cg = ctx.createRadialGradient(cx, cy, 10, cx, cy, cl.w * 0.5)
    cg.addColorStop(0, `rgba(255, 235, 220, ${cl.a})`)
    cg.addColorStop(0.6, `rgba(255, 205, 180, ${cl.a * 0.5})`)
    cg.addColorStop(1, 'rgba(255, 200, 180, 0)')
    ctx.fillStyle = cg
    ctx.beginPath()
    ctx.ellipse(cx, cy, cl.w * 0.5, cl.h * 0.5, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // Flock of swallows in the distance
  const birds = [
    [0.72, 0.25, 14], [0.75, 0.23, 11], [0.73, 0.21, 9], [0.77, 0.27, 12],
    [0.79, 0.24, 10], [0.81, 0.22, 8], [0.84, 0.25, 10], [0.71, 0.28, 7]
  ]
  ctx.fillStyle = 'rgba(25, 45, 65, 0.75)'
  for (const [bx, by, sz] of birds) {
    const px = W * bx
    const py = H * by
    ctx.beginPath()
    ctx.moveTo(px - sz, py)
    ctx.quadraticCurveTo(px - sz * 0.4, py - sz * 0.6, px, py - sz * 0.2)
    ctx.quadraticCurveTo(px + sz * 0.4, py - sz * 0.6, px + sz, py)
    ctx.quadraticCurveTo(px + sz * 0.3, py - sz * 0.2, px, py)
    ctx.quadraticCurveTo(px - sz * 0.3, py - sz * 0.2, px - sz, py)
    ctx.fill()
  }

  return c
}

function drawVerdantMountains(): HTMLCanvasElement {
  const [c, ctx] = canvas()
  // Far mountain silhouette
  const n1 = valueNoise1D(101)
  ctx.beginPath()
  ctx.moveTo(0, H)
  for (let x = 0; x <= W; x += 4) {
    const y = H * 0.62 - (fbm(n1, (x / W) * 2.8, 5) - 0.5) * 320
    ctx.lineTo(x, y)
  }
  ctx.lineTo(W, H)
  ctx.closePath()
  const g1 = ctx.createLinearGradient(0, H * 0.45, 0, H)
  g1.addColorStop(0, '#466785')
  g1.addColorStop(0.7, '#6f92ae')
  g1.addColorStop(1, '#a6c3d8')
  ctx.fillStyle = g1
  ctx.fill()

  // Mid-far mountain ridge with sunlight on right-facing slopes
  const n2 = valueNoise1D(202)
  ctx.beginPath()
  ctx.moveTo(0, H)
  for (let x = 0; x <= W; x += 4) {
    const y = H * 0.7 - (fbm(n2, (x / W) * 3.4, 4) - 0.5) * 240
    ctx.lineTo(x, y)
  }
  ctx.lineTo(W, H)
  ctx.closePath()
  const g2 = ctx.createLinearGradient(0, H * 0.55, 0, H)
  g2.addColorStop(0, '#2e4e6c')
  g2.addColorStop(0.8, '#4f7596')
  g2.addColorStop(1, '#94b7ce')
  ctx.fillStyle = g2
  ctx.fill()

  // Morning valley fog
  const fog = ctx.createLinearGradient(0, H * 0.68, 0, H)
  fog.addColorStop(0, 'rgba(235, 245, 235, 0)')
  fog.addColorStop(1, 'rgba(235, 245, 235, 0.6)')
  ctx.fillStyle = fog
  ctx.fillRect(0, H * 0.68, W, H * 0.32)

  return c
}

function drawVerdantFoothillsAndWindmill(): HTMLCanvasElement {
  const [c, ctx] = canvas()
  const n = valueNoise1D(303)
  const hillY = (x: number): number => H * 0.77 - (fbm(n, (x / W) * 2.2, 3) - 0.5) * 160

  // Rolling green foothills
  ctx.beginPath()
  ctx.moveTo(0, H)
  for (let x = 0; x <= W; x += 4) ctx.lineTo(x, hillY(x))
  ctx.lineTo(W, H)
  ctx.closePath()
  const g = ctx.createLinearGradient(0, H * 0.65, 0, H)
  g.addColorStop(0, '#386c40')
  g.addColorStop(0.4, '#4f8a58')
  g.addColorStop(1, '#2c5634')
  ctx.fillStyle = g
  ctx.fill()

  // Distant cypress trees on hill crests
  const rand = mulberry32(777)
  ctx.fillStyle = '#1c3e22'
  for (let x = 80; x < W - 80; x += 35 + rand() * 80) {
    if (x > 750 && x < 1050) continue // leave clearing for windmill
    const by = hillY(x)
    const th = 45 + rand() * 55
    const tw = th * 0.18
    ctx.beginPath()
    ctx.moveTo(x - tw, by)
    ctx.lineTo(x, by - th)
    ctx.lineTo(x + tw, by)
    ctx.closePath()
    ctx.fill()
  }

  // Dutch Windmill at x ≈ 900
  const wx = 900
  const wy = hillY(wx) + 10
  const bh = 170 // body height
  const bwTop = 32
  const bwBase = 48

  // Stone base & timber body
  ctx.fillStyle = '#4a3d31'
  ctx.beginPath()
  ctx.moveTo(wx - bwBase, wy)
  ctx.lineTo(wx - bwTop, wy - bh)
  ctx.lineTo(wx + bwTop, wy - bh)
  ctx.lineTo(wx + bwBase, wy)
  ctx.closePath()
  ctx.fill()

  // Conical roof cap
  ctx.fillStyle = '#261b14'
  ctx.beginPath()
  ctx.moveTo(wx - bwTop * 1.15, wy - bh)
  ctx.lineTo(wx, wy - bh - 42)
  ctx.lineTo(wx + bwTop * 1.15, wy - bh)
  ctx.closePath()
  ctx.fill()

  // Windows with morning light
  ctx.fillStyle = '#ffeaa7'
  ctx.fillRect(wx - 8, wy - bh * 0.65, 16, 20)
  ctx.fillRect(wx - 7, wy - bh * 0.35, 14, 18)

  // 4 Windmill Sails (Lattice blades)
  const ax = wx
  const ay = wy - bh - 10 // axle center
  const sailLen = 145
  const sailW = 26
  const rot = 0.55 // angle in radians (~32deg)

  for (let k = 0; k < 4; k++) {
    const a = rot + (k * Math.PI) / 2
    const cos = Math.cos(a)
    const sin = Math.sin(a)
    const perpX = -sin * sailW
    const perpY = cos * sailW

    // Spar
    ctx.strokeStyle = '#2b1e15'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(ax, ay)
    ctx.lineTo(ax + cos * sailLen, ay + sin * sailLen)
    ctx.stroke()

    // Sail canvas & lattice grid
    ctx.fillStyle = 'rgba(255, 250, 240, 0.85)'
    ctx.beginPath()
    ctx.moveTo(ax + cos * 25, ay + sin * 25)
    ctx.lineTo(ax + cos * sailLen, ay + sin * sailLen)
    ctx.lineTo(ax + cos * sailLen + perpX, ay + sin * sailLen + perpY)
    ctx.lineTo(ax + cos * 25 + perpX, ay + sin * 25 + perpY)
    ctx.closePath()
    ctx.fill()

    ctx.strokeStyle = '#3d2b1f'
    ctx.lineWidth = 1.2
    ctx.stroke()
  }

  // Axle cap
  ctx.fillStyle = '#1b120c'
  ctx.beginPath()
  ctx.arc(ax, ay, 9, 0, Math.PI * 2)
  ctx.fill()

  // Soft low valley haze
  const m = ctx.createLinearGradient(0, H * 0.78, 0, H)
  m.addColorStop(0, 'rgba(240, 250, 240, 0)')
  m.addColorStop(1, 'rgba(240, 250, 240, 0.4)')
  ctx.fillStyle = m
  ctx.fillRect(0, H * 0.78, W, H * 0.22)

  return c
}

function drawVerdantGround(): HTMLCanvasElement {
  const [c, ctx] = canvas()
  // Ground plane rotated -90deg on X:
  // y = 0 is closest to camera (foreground).
  // y = H is farthest from camera (distant horizon).
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#1c3d19') // rich deep loam & grass at feet
  g.addColorStop(0.3, '#2a5a24') // vibrant meadow
  g.addColorStop(0.65, '#417a35') // sunlit pasture
  g.addColorStop(0.88, '#699e56') // distant warm green
  g.addColorStop(1.0, '#a5cca0') // blends smoothly into horizon fog
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // Surface texture / grass stippling
  const rand = mulberry32(888)
  for (let i = 0; i < 4000; i++) {
    const rx = rand() * W
    const ry = rand() * H
    const bright = (rand() - 0.5) * 40
    ctx.fillStyle = bright > 0 ? `rgba(180, 235, 140, 0.15)` : `rgba(10, 30, 10, 0.18)`
    ctx.fillRect(rx, ry, 2 + rand() * 4, 3 + rand() * 5)
  }

  // Winding country dirt trail from y = 0 to y = H
  const pathX = (y: number): number =>
    W * 0.48 + Math.sin((y / H) * Math.PI * 1.5) * 160 + Math.cos((y / H) * Math.PI * 3.2) * 55

  const trailW = 320 // uniform width in texture space (3D camera handles foreshortening!)
  for (let y = 0; y < H; y += 4) {
    const cx = pathX(y)
    const tg = ctx.createLinearGradient(cx - trailW * 0.5, 0, cx + trailW * 0.5, 0)
    tg.addColorStop(0, 'rgba(40, 70, 30, 0)') // blends into grass
    tg.addColorStop(0.12, '#665037') // dirt edge
    tg.addColorStop(0.28, '#4a3723') // left wheel rut
    tg.addColorStop(0.5, '#8c7253') // center path ridge
    tg.addColorStop(0.72, '#4a3723') // right wheel rut
    tg.addColorStop(0.88, '#665037') // dirt edge
    tg.addColorStop(1.0, 'rgba(40, 70, 30, 0)')
    ctx.fillStyle = tg
    ctx.fillRect(cx - trailW * 0.5, y, trailW, 4)
  }

  // Scattered pebbles along the trail
  for (let i = 0; i < 500; i++) {
    const py = rand() * H
    const px = pathX(py) + (rand() - 0.5) * trailW * 0.8
    ctx.fillStyle = rand() > 0.4 ? 'rgba(210, 195, 170, 0.7)' : 'rgba(80, 65, 50, 0.8)'
    ctx.beginPath()
    ctx.arc(px, py, 1.5 + rand() * 3, 0, Math.PI * 2)
    ctx.fill()
  }

  // Cultivated Lavender / Crop rows on the left side
  const cropRows = [0.12, 0.19, 0.26, 0.33, 0.40]
  for (const fx of cropRows) {
    const baseX = W * fx
    for (let y = 20; y < H - 20; y += 12) {
      const cy = y
      const cx = baseX + Math.sin((y / H) * Math.PI * 0.5) * 40
      // Dark soil bed
      ctx.fillStyle = 'rgba(35, 25, 16, 0.65)'
      ctx.fillRect(cx - 18, cy - 5, 36, 10)
      // Lavender blooms
      const col = rand() > 0.4 ? '#8a64ad' : '#6b4791'
      ctx.fillStyle = col
      ctx.beginPath()
      ctx.arc(cx, cy, 5 + rand() * 3, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Pasture wildflower patches on the right side
  for (let i = 0; i < 750; i++) {
    const fx = 0.58 + rand() * 0.38
    const fy = rand() * (H - 50)
    const px = W * fx
    const py = fy
    const kind = rand()
    if (kind < 0.4) {
      // Golden buttercups
      ctx.fillStyle = '#ffca3a'
      ctx.fillRect(px, py, 4, 4)
    } else if (kind < 0.75) {
      // White daisies
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(px, py, 2.5, 0, Math.PI * 2)
      ctx.fill()
    } else {
      // Red field poppies
      ctx.fillStyle = '#e63946'
      ctx.beginPath()
      ctx.arc(px, py, 3.2, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Soft diagonal sunlight shadow bands (sun in upper right casting shadows down-left)
  ctx.save()
  ctx.rotate(-0.35)
  ctx.fillStyle = 'rgba(15, 35, 18, 0.08)'
  for (let sx = -W; sx < W * 2; sx += 220) {
    ctx.fillRect(sx, -H, 80, H * 3)
  }
  ctx.restore()

  return c
}

function drawOrchardGrove(): HTMLCanvasElement {
  const [c, ctx] = canvas()
  // Ground contact is at y = 1190.
  const groundY = 1190

  // 6 Fruit trees spaced naturally across the grove
  const trees = [
    { x: 320, h: 560, w: 260, seed: 11 },
    { x: 740, h: 620, w: 290, seed: 22 },
    { x: 1180, h: 540, w: 250, seed: 33 },
    { x: 1680, h: 590, w: 270, seed: 44 },
    { x: 2120, h: 630, w: 300, seed: 55 },
    { x: 2520, h: 530, w: 240, seed: 66 }
  ]

  for (const t of trees) {
    const rand = mulberry32(t.seed)
    const bx = t.x
    const by = groundY
    const ty = by - t.h

    // Tree shadow oval on ground
    ctx.fillStyle = 'rgba(15, 35, 18, 0.45)'
    ctx.beginPath()
    ctx.ellipse(bx - 35, by, t.w * 0.45, 22, -0.2, 0, Math.PI * 2)
    ctx.fill()

    // Trunk & Branches
    ctx.fillStyle = '#422e1e'
    ctx.beginPath()
    ctx.moveTo(bx - 28, by)
    ctx.quadraticCurveTo(bx - 18, by - t.h * 0.35, bx - 14, by - t.h * 0.6)
    ctx.lineTo(bx + 14, by - t.h * 0.6)
    ctx.quadraticCurveTo(bx + 18, by - t.h * 0.35, bx + 28, by)
    ctx.closePath()
    ctx.fill()

    // Bark lines & sunlit rim on right
    ctx.strokeStyle = '#6b4f35'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(bx + 20, by)
    ctx.quadraticCurveTo(bx + 12, by - t.h * 0.35, bx + 10, by - t.h * 0.6)
    ctx.stroke()

    // Primary branches spreading out
    const branches = [
      [bx - 12, by - t.h * 0.55, bx - t.w * 0.35, by - t.h * 0.78],
      [bx + 12, by - t.h * 0.55, bx + t.w * 0.38, by - t.h * 0.82],
      [bx, by - t.h * 0.6, bx, by - t.h * 0.88]
    ]
    ctx.strokeStyle = '#422e1e'
    ctx.lineWidth = 14
    for (const [x1, y1, x2, y2] of branches) {
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
    }

    // Billowing foliage canopy (clusters of shaded leafy lobes)
    const lobes = [
      { dx: 0, dy: -t.h * 0.88, r: t.w * 0.38 },
      { dx: -t.w * 0.28, dy: -t.h * 0.8, r: t.w * 0.34 },
      { dx: t.w * 0.28, dy: -t.h * 0.82, r: t.w * 0.35 },
      { dx: -t.w * 0.38, dy: -t.h * 0.68, r: t.w * 0.3 },
      { dx: t.w * 0.38, dy: -t.h * 0.69, r: t.w * 0.31 },
      { dx: 0, dy: -t.h * 0.72, r: t.w * 0.42 }
    ]

    for (const lb of lobes) {
      const lx = bx + lb.dx
      const ly = by + lb.dy
      // Spherical 3D shading: shadow on bottom-left, bright sunlit on top-right
      const fg = ctx.createRadialGradient(lx + lb.r * 0.3, ly - lb.r * 0.35, 5, lx, ly, lb.r)
      fg.addColorStop(0, '#98d975') // sunlit bright yellow-green
      fg.addColorStop(0.35, '#529948') // rich apple green
      fg.addColorStop(0.75, '#2f6e2b') // leaf shadow
      fg.addColorStop(1, '#1b4519') // deep core shade
      ctx.fillStyle = fg
      ctx.beginPath()
      ctx.arc(lx, ly, lb.r, 0, Math.PI * 2)
      ctx.fill()
    }

    // Bright ripe apples hanging from the branches
    for (let a = 0; a < 30; a++) {
      const ax = bx + (rand() - 0.5) * t.w * 0.75
      const ay = by - t.h * 0.6 - rand() * t.h * 0.35
      ctx.fillStyle = rand() > 0.3 ? '#e63946' : '#f4a261'
      ctx.beginPath()
      ctx.arc(ax, ay, 5.5 + rand() * 3, 0, Math.PI * 2)
      ctx.fill()
      // tiny sun highlight
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(ax - 2, ay - 2, 1.5, 1.5)
    }

    // Grass tufts at tree base
    ctx.fillStyle = '#3c7a36'
    for (let g = 0; g < 8; g++) {
      const gx = bx + (rand() - 0.5) * 55
      ctx.fillRect(gx, by - 12 - rand() * 10, 3, 14)
    }
  }

  // Low vineyard / garden crop rows running between trees
  for (let x = 150; x < W - 150; x += 180) {
    if (trees.some((t) => Math.abs(t.x - x) < 140)) continue
    // Timber stake
    ctx.fillStyle = '#4a3828'
    ctx.fillRect(x - 3, groundY - 140, 6, 140)
    // Bush foliage
    const bg = ctx.createRadialGradient(x, groundY - 80, 10, x, groundY - 70, 65)
    bg.addColorStop(0, '#74b860')
    bg.addColorStop(0.8, '#326c28')
    bg.addColorStop(1, '#1e4817')
    ctx.fillStyle = bg
    ctx.beginPath()
    ctx.ellipse(x, groundY - 70, 75, 55, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  return c
}

function drawNearMeadowAndFence(): HTMLCanvasElement {
  const [c, ctx] = canvas()
  const groundY = 1190

  // Rustic wooden fence on the left side (x = -40 to 1180)
  const posts = [-10, 240, 500, 760, 1020]
  const postH = 290
  const postW = 24

  // Fence posts
  for (const px of posts) {
    // Post shadow
    ctx.fillStyle = 'rgba(15, 30, 15, 0.4)'
    ctx.beginPath()
    ctx.ellipse(px - 20, groundY, 35, 12, -0.25, 0, Math.PI * 2)
    ctx.fill()

    // Post body
    ctx.fillStyle = '#4f3c2a'
    ctx.fillRect(px - postW * 0.5, groundY - postH, postW, postH)
    // Sunlit edge on right
    ctx.fillStyle = '#7a624a'
    ctx.fillRect(px + postW * 0.25, groundY - postH, postW * 0.25, postH)
    // Pointed post top
    ctx.fillStyle = '#3d2c1c'
    ctx.beginPath()
    ctx.moveTo(px - postW * 0.5, groundY - postH)
    ctx.lineTo(px, groundY - postH - 18)
    ctx.lineTo(px + postW * 0.5, groundY - postH)
    ctx.closePath()
    ctx.fill()
  }

  // 2 Horizontal split rails
  const railsY = [groundY - postH * 0.72, groundY - postH * 0.35]
  ctx.fillStyle = '#594430'
  for (const ry of railsY) {
    ctx.fillRect(-30, ry, 1100, 18)
    // Rail highlight
    ctx.fillStyle = '#856a50'
    ctx.fillRect(-30, ry, 1100, 4)
    ctx.fillStyle = '#594430'
  }

  // Morning glory vines climbing the fence
  const vineRand = mulberry32(444)
  for (let x = 20; x < 1050; x += 15) {
    const vy = groundY - postH * 0.5 + Math.sin(x * 0.05) * 45
    ctx.fillStyle = '#3a7832'
    ctx.fillRect(x, vy, 4, 4)
    if (vineRand() > 0.65) {
      ctx.fillStyle = vineRand() > 0.5 ? '#7209b7' : '#4361ee'
      ctx.beginPath()
      ctx.arc(x, vy, 6, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Sunflowers on the right side (x = 1520 to 1980)
  const sunflowers = [
    { x: 1560, h: 420 },
    { x: 1680, h: 480 },
    { x: 1810, h: 390 },
    { x: 1940, h: 450 }
  ]

  for (const sf of sunflowers) {
    const sx = sf.x
    const sy = groundY - sf.h

    // Stem
    ctx.strokeStyle = '#2d6a26'
    ctx.lineWidth = 10
    ctx.beginPath()
    ctx.moveTo(sx, groundY)
    ctx.quadraticCurveTo(sx + 15, groundY - sf.h * 0.5, sx, sy)
    ctx.stroke()

    // Leaves
    ctx.fillStyle = '#3d8334'
    ctx.beginPath()
    ctx.ellipse(sx - 35, groundY - sf.h * 0.4, 42, 22, -0.4, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(sx + 35, groundY - sf.h * 0.6, 45, 24, 0.4, 0, Math.PI * 2)
    ctx.fill()

    // Golden petals radiating outwards
    const petCount = 20
    const discR = 36
    const petLen = 42
    ctx.fillStyle = '#ffb703'
    for (let p = 0; p < petCount; p++) {
      const a = (p / petCount) * Math.PI * 2
      const px = sx + Math.cos(a) * (discR + petLen * 0.5)
      const py = sy + Math.sin(a) * (discR + petLen * 0.5)
      ctx.beginPath()
      ctx.ellipse(px, py, petLen * 0.5, 11, a, 0, Math.PI * 2)
      ctx.fill()
    }

    // Seed center disc
    const dg = ctx.createRadialGradient(sx, sy, 5, sx, sy, discR)
    dg.addColorStop(0, '#2b1708')
    dg.addColorStop(0.7, '#44260f')
    dg.addColorStop(1, '#663914')
    ctx.fillStyle = dg
    ctx.beginPath()
    ctx.arc(sx, sy, discR, 0, Math.PI * 2)
    ctx.fill()
  }

  // Flowering lavender and wild daisy bushes along the base
  for (let x = 60; x < W - 60; x += 32) {
    if (x > 1050 && x < 1500) continue // leave path open
    const bh = 70 + vineRand() * 50
    ctx.fillStyle = vineRand() > 0.4 ? '#8352b0' : '#ffffff'
    ctx.beginPath()
    ctx.arc(x, groundY - bh, 6 + vineRand() * 5, 0, Math.PI * 2)
    ctx.fill()
    // Stem to ground
    ctx.strokeStyle = '#2d6028'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(x, groundY)
    ctx.lineTo(x, groundY - bh)
    ctx.stroke()
  }

  return c
}

function drawForegroundCanopy(): HTMLCanvasElement {
  const [c, ctx] = canvas()

  // Top-left massive ancient oak branch reaching across the frame
  ctx.fillStyle = '#261b11'
  ctx.beginPath()
  ctx.moveTo(-50, -50)
  ctx.quadraticCurveTo(350, 60, 780, 260)
  ctx.lineTo(760, 310)
  ctx.quadraticCurveTo(320, 130, -50, 40)
  ctx.closePath()
  ctx.fill()

  // Top-right oak branch
  ctx.beginPath()
  ctx.moveTo(W + 50, -30)
  ctx.quadraticCurveTo(W - 320, 80, W - 680, 240)
  ctx.lineTo(W - 660, 290)
  ctx.quadraticCurveTo(W - 280, 140, W + 50, 60)
  ctx.closePath()
  ctx.fill()

  // Leaf clusters hanging from the top branches (framing the view)
  const rand = mulberry32(999)
  const leafClusters = [
    { x: 180, y: 120, r: 160 }, { x: 420, y: 180, r: 180 }, { x: 680, y: 280, r: 150 },
    { x: 80, y: 220, r: 140 }, { x: W - 220, y: 140, r: 170 }, { x: W - 520, y: 220, r: 160 },
    { x: W - 720, y: 280, r: 130 }
  ]
  for (const lc of leafClusters) {
    for (let i = 0; i < 28; i++) {
      const lx = lc.x + (rand() - 0.5) * lc.r * 1.5
      const ly = lc.y + (rand() - 0.5) * lc.r * 1.2
      const lg = ctx.createRadialGradient(lx, ly, 4, lx, ly, 38)
      lg.addColorStop(0, '#88d958') // sunlit translucent green
      lg.addColorStop(0.5, '#40822e')
      lg.addColorStop(1, '#173612') // deep silhouette
      ctx.fillStyle = lg
      ctx.beginPath()
      ctx.ellipse(lx, ly, 35, 20, rand() * Math.PI, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Giant wild ferns in the bottom-left and bottom-right corners
  const drawFern = (baseX: number, baseY: number, dir: 1 | -1) => {
    for (let f = 0; f < 8; f++) {
      const frondLen = 420 + rand() * 180
      const angle = (-0.35 + (f / 8) * 0.7) * dir
      ctx.save()
      ctx.translate(baseX, baseY)
      ctx.rotate(angle)
      // Frond stem
      ctx.strokeStyle = '#1a3e16'
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.quadraticCurveTo(dir * 120, -frondLen * 0.6, dir * 180, -frondLen)
      ctx.stroke()
      // Pinnae (leaflets)
      for (let p = 40; p < frondLen; p += 22) {
        const pw = (1 - p / frondLen) * 75
        const px = (p / frondLen) * dir * 160
        const py = -p
        ctx.fillStyle = p > frondLen * 0.5 ? '#55a342' : '#22501b'
        ctx.beginPath()
        ctx.ellipse(px - pw * 0.5 * dir, py, pw * 0.5, 9, 0.3 * dir, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.ellipse(px + pw * 0.5 * dir, py, pw * 0.5, 9, -0.3 * dir, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }
  }

  drawFern(80, H + 40, 1)
  drawFern(W - 80, H + 40, -1)

  // Scarlet wild poppies in the foreground corners
  const poppies = [
    [160, H - 180], [280, H - 240], [360, H - 160],
    [W - 220, H - 210], [W - 340, H - 190]
  ]
  for (const [px, py] of poppies) {
    // Stem
    ctx.strokeStyle = '#275820'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(px, H)
    ctx.quadraticCurveTo(px + 10, py + 80, px, py)
    ctx.stroke()
    // Red petals
    ctx.fillStyle = '#d90429'
    ctx.beginPath()
    ctx.arc(px, py, 26, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ef233c'
    ctx.beginPath()
    ctx.arc(px - 4, py - 4, 18, 0, Math.PI * 2)
    ctx.fill()
    // Black center
    ctx.fillStyle = '#111111'
    ctx.beginPath()
    ctx.arc(px, py, 8, 0, Math.PI * 2)
    ctx.fill()
  }

  return c
}

type Plate = {
  name: string
  z: number
  draw: () => HTMLCanvasElement
  position?: Vec3
  rotation?: Vec3
  scale?: Vec3
  autoScale?: boolean
}

interface ShotSpec {
  name: string
  plates: Plate[]
  title: string
  subtitle: string
  titleColor?: string
  subtitleColor: string
  /** When the camera arrives: titles animate in relative to this. */
  arrive: number
  particles: { name: string; seed: number; count: number; size: number; color: string; velocity: Vec3; sway: number }
}

export async function buildDemoProject(): Promise<Project> {
  assetStore.clear()
  // Tour timing (see `steps` below): Verdant Valley (0-6s) → Twilight Valley (6-11.5s) → Northern Lights (11.5-15.7s) → Golden Dunes (15.7-19.2s).
  const project = createProject({ name: 'Parallax Journey', duration: 19.2 })
  const comp = project.comp
  const d = referenceDistance(comp)
  const spacing = shotSpacing(comp)

  const specs: ShotSpec[] = [
    {
      name: 'Verdant Valley',
      arrive: 0.6,
      title: 'VERDANT VALLEY',
      subtitle: 'where the earth breathes life',
      titleColor: '#fffdf5',
      subtitleColor: '#ffe29c',
      particles: { name: 'Morning Pollen', seed: 108, count: 420, size: 6, color: '#fff0a6', velocity: [16, 10, 0], sway: 36 },
      plates: [
        {
          name: 'Morning Sky',
          z: 3400,
          draw: drawMorningSky
        },
        {
          name: 'Azure Mountains',
          z: 2400,
          draw: drawVerdantMountains
        },
        {
          name: 'Green Foothills',
          z: 1500,
          draw: drawVerdantFoothillsAndWindmill
        },
        {
          name: 'Lush Meadow Ground',
          z: 900,
          position: [0, -430, 900],
          rotation: [-90, 0, 0],
          scale: [2.2, 3.8, 1],
          autoScale: false,
          draw: drawVerdantGround
        },
        {
          name: 'Fruit Orchard',
          z: 800,
          draw: drawOrchardGrove
        },
        {
          name: 'Rustic Fence & Flora',
          z: 280,
          draw: drawNearMeadowAndFence
        },
        {
          name: 'Foreground Oak & Ferns',
          z: -220,
          draw: drawForegroundCanopy
        }
      ]
    },
    {
      name: 'Twilight Valley',
      arrive: 6.0,
      title: 'TWILIGHT VALLEY',
      subtitle: 'a parallax story',
      subtitleColor: '#ffe4cf',
      particles: { name: 'Fireflies', seed: 2024, count: 360, size: 7, color: '#ffd59a', velocity: [10, 16, 0], sway: 40 },
      plates: [
        {
          name: 'Sky',
          z: 3200,
          draw: () =>
            drawSky({
              stops: [
                [0, '#070a24'],
                [0.35, '#251a52'],
                [0.6, '#7a3f78'],
                [0.78, '#e2786a'],
                [1, '#ffc48a']
              ],
              stars: 900,
              starSeed: 7,
              sun: { x: 0.62, y: 0.66, r: 70, core: '#fff1d6', glow: '255,200,150' }
            })
        },
        {
          name: 'Far Mountains',
          z: 2100,
          draw: () => drawRidge({ seed: 11, base: 0.64, amp: 210, freq: 3, top: '#6b4f8f', bottom: '#b07a9a', mist: 'rgba(240,160,150,0.55)' })
        },
        {
          name: 'Mid Mountains',
          z: 1200,
          draw: () => drawRidge({ seed: 23, base: 0.72, amp: 170, freq: 4, top: '#3a2a62', bottom: '#6a4a7c', mist: 'rgba(200,120,140,0.45)' })
        },
        {
          name: 'Pine Hills',
          z: 450,
          draw: () =>
            drawRidge({
              seed: 37,
              base: 0.82,
              amp: 90,
              freq: 3,
              top: '#1d1838',
              bottom: '#2a1f44',
              trees: { density: 1.4, minH: 60, maxH: 140, color: '#1d1838' }
            })
        },
        {
          name: 'Valley Floor',
          z: 850,
          position: [0, -450, 850],
          rotation: [-90, 0, 0],
          scale: [1.8, 2.8, 1],
          autoScale: false,
          draw: () =>
            drawGround({
              nearColor: '#0a0812',
              farColor: '#241a38',
              gridColor: 'rgba(255, 200, 160, 0.07)',
              mistColor: 'rgba(200, 130, 150, 0.35)'
            })
        },
        {
          name: 'Foreground',
          z: -260,
          draw: () =>
            drawRidge({
              seed: 51,
              base: 0.95,
              amp: 50,
              freq: 2,
              top: '#0a0912',
              bottom: '#050409',
              trees: { density: 1, minH: 380, maxH: 760, color: '#08070f', sides: true }
            })
        }
      ]
    },
    {
      name: 'Northern Lights',
      arrive: 11.5,
      title: 'NORTHERN LIGHTS',
      subtitle: 'where the sky dances',
      titleColor: '#eafff8',
      subtitleColor: '#a8f5dc',
      particles: { name: 'Snow', seed: 77, count: 520, size: 5, color: '#ffffff', velocity: [-8, -38, 0], sway: 28 },
      plates: [
        { name: 'Aurora Sky', z: 3200, draw: drawAuroraSky },
        {
          name: 'Snow Peaks',
          z: 2100,
          draw: () => drawRidge({ seed: 61, base: 0.66, amp: 260, freq: 3.5, octaves: 6, top: '#d4e4f2', bottom: '#3d5a78', mist: 'rgba(12,44,64,0.6)' })
        },
        {
          name: 'Glacier Ridge',
          z: 1200,
          draw: () => drawRidge({ seed: 73, base: 0.76, amp: 150, freq: 4, top: '#86a3bf', bottom: '#1d3048', mist: 'rgba(8,24,40,0.55)' })
        },
        {
          name: 'Frozen Lake',
          z: 850,
          position: [0, -450, 850],
          rotation: [-90, 0, 0],
          scale: [1.8, 2.8, 1],
          autoScale: false,
          draw: () =>
            drawGround({
              nearColor: '#030a10',
              farColor: '#102838',
              gridColor: 'rgba(100, 240, 220, 0.09)',
              mistColor: 'rgba(120, 255, 230, 0.3)'
            })
        },
        {
          name: 'Snow Forest',
          z: 450,
          draw: () =>
            drawRidge({
              seed: 83,
              base: 0.86,
              amp: 70,
              freq: 3,
              top: '#0b1a26',
              bottom: '#06121b',
              trees: { density: 1.6, minH: 70, maxH: 170, color: '#081521' }
            })
        },
        {
          name: 'Snowbank',
          z: -260,
          draw: () =>
            drawRidge({
              seed: 97,
              base: 0.96,
              amp: 40,
              freq: 2,
              top: '#9fb6cf',
              bottom: '#4f6985',
              trees: { density: 1, minH: 380, maxH: 720, color: '#040b12', sides: true }
            })
        }
      ]
    },
    {
      name: 'Golden Dunes',
      arrive: 15.7,
      title: 'GOLDEN DUNES',
      subtitle: 'the long road home',
      titleColor: '#fff3df',
      subtitleColor: '#ffd9a8',
      particles: { name: 'Dust', seed: 909, count: 260, size: 4, color: '#ffd8a8', velocity: [42, 6, 0], sway: 18 },
      plates: [
        {
          name: 'Desert Sky',
          z: 3200,
          draw: () =>
            drawSky({
              stops: [
                [0, '#14204a'],
                [0.3, '#4f3f83'],
                [0.6, '#df8668'],
                [0.82, '#ffbf78'],
                [1, '#ffe2aa']
              ],
              stars: 220,
              starSeed: 31,
              sun: { x: 0.36, y: 0.6, r: 92, core: '#fff6e0', glow: '255,214,150' }
            })
        },
        {
          name: 'Far Dunes',
          z: 2100,
          draw: () => drawRidge({ seed: 101, base: 0.62, amp: 110, freq: 1.6, octaves: 2, top: '#c9805e', bottom: '#e8aa7c', mist: 'rgba(255,205,155,0.5)' })
        },
        {
          name: 'Mid Dunes',
          z: 1200,
          draw: () => drawRidge({ seed: 113, base: 0.69, amp: 100, freq: 1.8, octaves: 2, top: '#a8583e', bottom: '#d28c5e', mist: 'rgba(255,170,120,0.35)' })
        },
        {
          name: 'Desert Floor',
          z: 850,
          position: [0, -450, 850],
          rotation: [-85, 0, 0],
          scale: [1.8, 2.8, 1],
          autoScale: false,
          draw: () =>
            drawGround({
              nearColor: '#150806',
              farColor: '#3d1c16',
              gridColor: 'rgba(255, 180, 120, 0.08)',
              mistColor: 'rgba(240, 140, 80, 0.35)'
            })
        },
        {
          name: 'Near Dunes',
          z: 450,
          draw: () => drawRidge({ seed: 127, base: 0.77, amp: 90, freq: 1.4, octaves: 2, top: '#6d3328', bottom: '#94513a' })
        },
        {
          name: 'Dune Edge',
          z: -260,
          draw: () => drawRidge({ seed: 131, base: 0.86, amp: 60, freq: 1.5, octaves: 3, top: '#2a1310', bottom: '#120706' })
        }
      ]
    }
  ]

  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i]
    const shot = createShot(spec.name, [i * spacing, 0, 0], i)
    project.shots.push(shot)
    const shotLayers: Layer[] = []

    for (const p of spec.plates) {
      const asset = await assetStore.addCanvas(`${p.name}.png`, p.draw())
      project.assets.push(asset.meta)
      const layer = createImageLayer(asset.meta, comp, p.z)
      layer.name = p.name
      if (p.rotation) layer.transform.rotation.value = p.rotation
      if (p.position) layer.transform.position.value = p.position
      if (p.autoScale !== undefined) layer.autoScale = p.autoScale
      if (p.scale) {
        layer.transform.scale.value = p.scale
      } else {
        // Plates are 1.4× the comp; render 1:1 so there is margin for camera moves.
        layer.transform.scale.value = [comp.width / 1920, comp.width / 1920, 1]
      }
      shotLayers.unshift(layer)
    }

    const a = spec.arrive
    const title = createTextLayer(comp, spec.title)
    title.name = `${spec.name} · Title`
    title.props = { ...title.props, fontFamily: 'Montserrat', fontWeight: 800, fontSize: 92, letterSpacing: 12, ...(spec.titleColor ? { color: spec.titleColor } : {}) }
    title.transform.position.value = [0, 230, 700]
    addKeyframe(title.transform.opacity, a, 0, 'easeOut')
    addKeyframe(title.transform.opacity, a + 1.8, 1, 'easeOut')
    addKeyframe(title.transform.position, a, [0, 170, 700] as Vec3, 'easeOut')
    addKeyframe(title.transform.position, a + 2.4, [0, 230, 700] as Vec3, 'easeOut')

    const subtitle = createTextLayer(comp, spec.subtitle)
    subtitle.name = `${spec.name} · Subtitle`
    subtitle.props = { ...subtitle.props, fontFamily: 'Playfair Display', fontWeight: 400, fontSize: 44, letterSpacing: 5, color: spec.subtitleColor }
    subtitle.transform.position.value = [0, 135, 700]
    addKeyframe(subtitle.transform.opacity, a + 1.2, 0, 'easeOut')
    addKeyframe(subtitle.transform.opacity, a + 2.8, 0.9, 'easeOut')

    const pt = spec.particles
    const particles = createParticleLayer(comp)
    particles.name = pt.name
    particles.props = {
      ...particles.props,
      seed: pt.seed,
      count: pt.count,
      size: pt.size,
      color: pt.color,
      area: [comp.width * 2.4, comp.height * 1.6, d * 1.8],
      velocity: pt.velocity,
      sway: pt.sway
    }
    particles.transform.position.value = [0, -150, 500]

    shotLayers.unshift(particles, title, subtitle)
    for (const l of shotLayers) l.shotId = shot.id
    project.layers.push(...shotLayers)
  }

  // Camera tour: Verdant Valley (3D ground/orchard) → Twilight Valley → Northern Lights → Golden Dunes.
  const [s1, s2, s3, s4] = project.shots
  const end = buildCameraPath(
    project,
    [
      { shotId: s1.id, hold: 3.5, type: 'arc', transition: 2.5 },
      { shotId: s2.id, hold: 3.0, type: 'arc', transition: 2.5 },
      { shotId: s3.id, hold: 3.0, type: 'fade', transition: 1.2 },
      { shotId: s4.id, hold: 3.5, type: 'cut', transition: 0 }
    ],
    { pushIn: 0.14 }
  )
  project.comp.duration = Math.round(end * comp.fps) / comp.fps
  for (const l of project.layers) l.outPoint = project.comp.duration

  project.camera.shakeAmount = 4
  project.camera.shakeSpeed = 0.35
  project.camera.dofEnabled = true
  project.camera.aperture.value = 0.35
  // The path focuses on each shot's origin; titles sit at z≈700, so pull focus onto them.
  for (const k of project.camera.focusDistance.keyframes) k.value += 700

  project.look = {
    ...project.look,
    fogEnabled: true,
    fogColor: '#2c2848',
    fogNear: 2400,
    fogFar: 9000,
    vignette: 0.45,
    grain: 0.05,
    contrast: 1.05,
    saturation: 1.05
  }

  // Freeze-safe deep copy (immer will take ownership).
  return structuredClone(project)
}
