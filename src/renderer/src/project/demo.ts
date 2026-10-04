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
  const g = ctx.createLinearGradient(0, H, 0, 0)
  g.addColorStop(0, o.nearColor)
  g.addColorStop(0.65, o.farColor)
  g.addColorStop(1, o.mistColor ?? o.farColor)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  ctx.strokeStyle = o.gridColor ?? 'rgba(255, 255, 255, 0.08)'
  ctx.lineWidth = 2
  for (let x = -W * 0.5; x <= W * 1.5; x += 180) {
    ctx.beginPath()
    ctx.moveTo(x, H)
    ctx.lineTo(W / 2 + (x - W / 2) * 0.15, 0)
    ctx.stroke()
  }
  for (let i = 0; i < 28; i++) {
    const t = Math.pow(i / 27, 2.2)
    const y = H - t * H
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
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
  // Tour timing (see `steps` below): arrive at shot 2 at 6.0s, shot 3 at ~10.2s, end 13.2s.
  const project = createProject({ name: 'Parallax Journey', duration: 13.2 })
  const comp = project.comp
  const d = referenceDistance(comp)
  const spacing = shotSpacing(comp)

  const specs: ShotSpec[] = [
    {
      name: 'Twilight Valley',
      arrive: 0.6,
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
      arrive: 6.0,
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
      arrive: 10.3,
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

  // Camera tour: slow push-in on each shot, arc over to the aurora, fade to the desert.
  const [s1, s2, s3] = project.shots
  const end = buildCameraPath(
    project,
    [
      { shotId: s1.id, hold: 3.5, type: 'arc', transition: 2.5 },
      { shotId: s2.id, hold: 3, type: 'fade', transition: 1.2 },
      { shotId: s3.id, hold: 3, type: 'cut', transition: 0 }
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
