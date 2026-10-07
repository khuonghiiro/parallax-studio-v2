/**
 * After Effects 2.5D Volumetric Depth Extrusion & Procedural Mesh Dynamics
 * Recreates After Effects techniques:
 * 1. Luminance & Geometric Displacement Map (Depth from 2D image)
 * 2. Puppet Pin / Wave Warp / Wind Sway / Breathing / Organic Wiggle Dynamics
 */

export type DepthProfileType = 'none' | 'luminance' | 'sphere' | 'cylinder' | 'slope' | 'ridge'

export type MotionType = 'none' | 'wind' | 'wave' | 'breathe' | 'wiggle'

export type MotionDirection = 'both' | 'horizontal' | 'vertical' | 'depthZ'

export type MotionAnchor = 'bottom' | 'top' | 'left' | 'center' | 'all'

export type LuminanceSampler = (u: number, v: number) => number

/**
 * Creates a high-speed luminance sampler (0..1) from an image or canvas.
 * Follows ITU-R BT.601 standard: Y = 0.299*R + 0.587*G + 0.114*B
 */
export function createLuminanceSampler(
  image: HTMLImageElement | HTMLCanvasElement,
  sampleWidth = 128,
  sampleHeight = 128
): LuminanceSampler {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = sampleWidth
    canvas.height = sampleHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return () => 0.5

    ctx.drawImage(image, 0, 0, sampleWidth, sampleHeight)
    const imgData = ctx.getImageData(0, 0, sampleWidth, sampleHeight).data

    return (u: number, v: number): number => {
      const cu = Math.max(0, Math.min(1, u))
      // Texture space v=1 is top, v=0 is bottom; canvas y=0 is top, y=1 is bottom
      const cv = Math.max(0, Math.min(1, 1 - v))

      const px = Math.floor(cu * (sampleWidth - 1))
      const py = Math.floor(cv * (sampleHeight - 1))
      const idx = (py * sampleWidth + px) * 4

      const r = imgData[idx] ?? 128
      const g = imgData[idx + 1] ?? 128
      const b = imgData[idx + 2] ?? 128

      return (0.299 * r + 0.587 * g + 0.114 * b) / 255
    }
  } catch {
    return () => 0.5
  }
}

export interface DepthDisplacementParams {
  u: number
  v: number
  width: number
  height: number
  profile?: DepthProfileType
  intensity?: number // -200..200 (percentage)
  invert?: boolean
  luminanceSampler?: LuminanceSampler
}

/**
 * Calculates Z displacement for 2.5D Depth Extrusion (AE Displacement Map / 3D Relief)
 */
export function computeDepthProfileZ(params: DepthDisplacementParams): number {
  const {
    u,
    v,
    width,
    height,
    profile = 'none',
    intensity = 0,
    invert = false,
    luminanceSampler
  } = params

  if (profile === 'none' || intensity === 0) return 0

  const maxDepth = (intensity / 100) * (Math.min(width, height) * 0.4)
  let rawVal = 0

  switch (profile) {
    case 'luminance': {
      const lum = luminanceSampler ? luminanceSampler(u, v) : 0.5
      // Centered around 0.5: bright protrudes forward, dark recedes backward
      rawVal = (lum - 0.5) * 2
      break
    }
    case 'sphere': {
      // 3D spherical dome / bulge
      const dx = (u - 0.5) * 2
      const dy = (v - 0.5) * 2
      const distSq = dx * dx + dy * dy
      rawVal = distSq < 1 ? Math.sqrt(1 - distSq) : 0
      break
    }
    case 'cylinder': {
      // Arching half-cylinder / tunnel
      rawVal = Math.sin(u * Math.PI)
      break
    }
    case 'slope': {
      // Linear ramp: bottom (v=0) protrudes, top (v=1) recedes
      rawVal = 1 - v
      break
    }
    case 'ridge': {
      // Peak roof ridge in center (u=0.5) sloping down to edges
      rawVal = 1 - Math.abs((u - 0.5) * 2)
      break
    }
    default:
      return 0
  }

  const finalVal = invert ? -rawVal : rawVal
  return finalVal * maxDepth
}

export interface ProceduralMotionParams {
  u: number
  v: number
  width: number
  height: number
  time: number
  motionType?: MotionType
  speed?: number
  amplitude?: number
  direction?: MotionDirection
  anchor?: MotionAnchor
  isPinned?: boolean
}

/**
 * Computes After Effects procedural mesh vertex motion [dx, dy, dz]
 */
export function computeProceduralMotionOffset(
  params: ProceduralMotionParams
): [number, number, number] {
  const {
    u,
    v,
    width,
    height,
    time,
    motionType = 'none',
    speed = 1.0,
    amplitude = 20,
    direction = 'both',
    anchor = 'bottom',
    isPinned = false
  } = params

  if (motionType === 'none' || amplitude === 0 || isPinned) {
    return [0, 0, 0]
  }

  // Anchor weight calculation (0 = completely pinned, 1 = maximum sway)
  let anchorWeight = 1.0
  switch (anchor) {
    case 'bottom':
      // Base (v=0) is stationary, top (v=1) sways strongly
      anchorWeight = Math.pow(v, 1.4)
      break
    case 'top':
      // Top (v=1) is stationary, bottom (v=0) swings
      anchorWeight = Math.pow(1 - v, 1.4)
      break
    case 'left':
      anchorWeight = Math.pow(u, 1.4)
      break
    case 'center': {
      const distFromCenter = Math.hypot((u - 0.5) * 2, (v - 0.5) * 2)
      anchorWeight = Math.min(1.0, distFromCenter)
      break
    }
    case 'all':
      anchorWeight = 1.0
      break
  }

  const ampRatio = Math.max(0, amplitude) / 100
  let dx = 0
  let dy = 0
  let dz = 0

  switch (motionType) {
    case 'wind': {
      // Organic wind gust with primary harmonic and secondary gust flutter
      const phase = time * speed * 3.2 - (1 - v) * 2.8
      const sway = Math.sin(phase) + 0.35 * Math.sin(phase * 2.4)
      const maxTravel = ampRatio * (width * 0.18)

      dx = sway * maxTravel * anchorWeight
      // Length conservation dip: as tree/cloth leans right or left, its top drops slightly
      dy = -Math.abs(sway) * (maxTravel * 0.22) * anchorWeight
      dz = Math.cos(phase * 0.8) * (maxTravel * 0.15) * anchorWeight
      break
    }
    case 'wave': {
      // 2D Travelling ripple across surface (water, flags, curtains)
      const phase = time * speed * 4.0 + u * 6.28 + v * 3.14
      const ripple = Math.sin(phase)
      const maxRipple = ampRatio * (Math.min(width, height) * 0.12)

      dz = ripple * maxRipple * anchorWeight
      dy = Math.cos(phase) * (maxRipple * 0.4) * anchorWeight
      dx = Math.sin(phase * 0.5) * (maxRipple * 0.2) * anchorWeight
      break
    }
    case 'breathe': {
      // Organic thoracic breathing expansion & contraction
      const phase = time * speed * 2.2
      const pulse = Math.sin(phase)
      const cx = (u - 0.5) * 2
      const cy = (v - 0.5) * 2
      const maxRadius = ampRatio * (width * 0.08)

      dx = cx * maxRadius * pulse * anchorWeight
      dy = cy * maxRadius * pulse * anchorWeight
      dz = Math.cos(Math.min(1, Math.hypot(cx, cy)) * (Math.PI / 2)) * maxRadius * 1.5 * pulse
      break
    }
    case 'wiggle': {
      // After Effects multi-frequency organic wiggle expression
      const t = time * speed * 2.6 + u * 2.0 + v * 1.5
      const w1 = Math.sin(t * 1.0) * 0.5 + Math.sin(t * 2.7) * 0.3 + Math.sin(t * 5.3) * 0.2
      const w2 = Math.cos(t * 1.2) * 0.5 + Math.cos(t * 3.1) * 0.3 + Math.cos(t * 6.1) * 0.2
      const maxJitter = ampRatio * (Math.min(width, height) * 0.09)

      dx = w1 * maxJitter * anchorWeight
      dy = w2 * maxJitter * anchorWeight
      dz = ((w1 + w2) / 2) * maxJitter * anchorWeight
      break
    }
  }

  // Filter based on chosen axis direction
  if (direction === 'horizontal') {
    dy = 0
    dz = 0
  } else if (direction === 'vertical') {
    dx = 0
    dz = 0
  } else if (direction === 'depthZ') {
    dx = 0
    dy = 0
  }

  return [
    Math.abs(dx) < 1e-6 ? 0 : dx,
    Math.abs(dy) < 1e-6 ? 0 : dy,
    Math.abs(dz) < 1e-6 ? 0 : dz
  ]
}
