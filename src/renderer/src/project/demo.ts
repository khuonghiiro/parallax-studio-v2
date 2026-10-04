import type { Project, Vec3 } from '@shared/types'
import { addKeyframe } from '../animation/keyframes'
import { mulberry32, referenceDistance } from '../animation/math'
import { applyCameraPreset } from '../animation/presets'
import { assetStore } from './assets'
import { createImageLayer, createParticleLayer, createProject, createTextLayer } from './factory'

/**
 * Builds a procedural twilight landscape (transparent PNG plates drawn on canvas)
 * so the app opens with a fully animated parallax scene.
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

function drawSky(): HTMLCanvasElement {
  const [c, ctx] = canvas()
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#070a24')
  g.addColorStop(0.35, '#251a52')
  g.addColorStop(0.6, '#7a3f78')
  g.addColorStop(0.78, '#e2786a')
  g.addColorStop(1, '#ffc48a')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  const rand = mulberry32(7)
  for (let i = 0; i < 900; i++) {
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

  // Setting sun with soft glow.
  const sx = W * 0.62
  const sy = H * 0.66
  const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, H * 0.6)
  glow.addColorStop(0, 'rgba(255,220,170,0.95)')
  glow.addColorStop(0.08, 'rgba(255,190,140,0.75)')
  glow.addColorStop(0.3, 'rgba(255,140,120,0.25)')
  glow.addColorStop(1, 'rgba(255,120,120,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#fff1d6'
  ctx.beginPath()
  ctx.arc(sx, sy, 70, 0, Math.PI * 2)
  ctx.fill()
  return c
}

interface RidgeOpts {
  seed: number
  base: number // 0..1 of height
  amp: number // px
  freq: number
  top: string
  bottom: string
  trees?: { density: number; minH: number; maxH: number; color: string; sides?: boolean }
  mist?: string
}

function drawRidge(o: RidgeOpts): HTMLCanvasElement {
  const [c, ctx] = canvas()
  const noise = valueNoise1D(o.seed)
  const ridgeY = (x: number): number => H * o.base - (fbm(noise, (x / W) * o.freq) - 0.5) * 2 * o.amp

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

export async function buildDemoProject(): Promise<Project> {
  assetStore.clear()
  const project = createProject({ name: 'Twilight Valley', duration: 10 })
  const comp = project.comp
  const d = referenceDistance(comp)

  const plates: { name: string; canvas: HTMLCanvasElement; z: number }[] = [
    { name: 'Sky', canvas: drawSky(), z: 3200 },
    {
      name: 'Far Mountains',
      z: 2100,
      canvas: drawRidge({ seed: 11, base: 0.64, amp: 210, freq: 3, top: '#6b4f8f', bottom: '#b07a9a', mist: 'rgba(240,160,150,0.55)' })
    },
    {
      name: 'Mid Mountains',
      z: 1200,
      canvas: drawRidge({ seed: 23, base: 0.72, amp: 170, freq: 4, top: '#3a2a62', bottom: '#6a4a7c', mist: 'rgba(200,120,140,0.45)' })
    },
    {
      name: 'Pine Hills',
      z: 450,
      canvas: drawRidge({
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
      name: 'Foreground',
      z: -260,
      canvas: drawRidge({
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

  for (const p of plates) {
    const asset = await assetStore.addCanvas(`${p.name}.png`, p.canvas)
    project.assets.push(asset.meta)
    const layer = createImageLayer(asset.meta, comp, p.z)
    layer.name = p.name
    // Plates are 1.4× the comp; render 1:1 so there is margin for camera moves.
    layer.transform.scale.value = [comp.width / 1920, comp.width / 1920, 1]
    project.layers.unshift(layer)
  }

  const title = createTextLayer(comp, 'TWILIGHT VALLEY')
  title.name = 'Title'
  title.props = { ...title.props, fontFamily: 'Montserrat', fontWeight: 800, fontSize: 92, letterSpacing: 12 }
  title.transform.position.value = [0, 230, 700]
  addKeyframe(title.transform.opacity, 0.6, 0, 'easeOut')
  addKeyframe(title.transform.opacity, 2.4, 1, 'easeOut')
  addKeyframe(title.transform.position, 0.6, [0, 170, 700] as Vec3, 'easeOut')
  addKeyframe(title.transform.position, 3.0, [0, 230, 700] as Vec3, 'easeOut')

  const subtitle = createTextLayer(comp, 'a parallax story')
  subtitle.name = 'Subtitle'
  subtitle.props = { ...subtitle.props, fontFamily: 'Playfair Display', fontWeight: 400, fontSize: 44, letterSpacing: 5, color: '#ffe4cf' }
  subtitle.transform.position.value = [0, 135, 700]
  addKeyframe(subtitle.transform.opacity, 1.8, 0, 'easeOut')
  addKeyframe(subtitle.transform.opacity, 3.4, 0.9, 'easeOut')

  const fireflies = createParticleLayer(comp)
  fireflies.name = 'Fireflies'
  fireflies.props = {
    ...fireflies.props,
    seed: 2024,
    count: 360,
    size: 7,
    color: '#ffd59a',
    area: [comp.width * 2.4, comp.height * 1.6, d * 1.8],
    velocity: [10, 16, 0],
    sway: 40
  }
  fireflies.transform.position.value = [0, -150, 500]

  project.layers.unshift(fireflies, title, subtitle)

  applyCameraPreset(project.camera, 'dollyIn', comp, 0, comp.duration, 1)
  project.camera.shakeAmount = 4
  project.camera.shakeSpeed = 0.35
  project.camera.dofEnabled = true
  project.camera.aperture.value = 0.45
  addKeyframe(project.camera.focusDistance, 0, Math.round(700 + d), 'easeInOut')
  addKeyframe(project.camera.focusDistance, comp.duration, Math.round(700 + d * 0.6), 'easeInOut')

  project.look = {
    ...project.look,
    fogEnabled: true,
    fogColor: '#3a2a5c',
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
