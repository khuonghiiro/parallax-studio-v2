import { createPlateCanvas, W, H } from './canvas'
import { drawBroadleafPlant, drawFoliageCloud, drawPineTree, drawStylizedTree } from './treePrimitives'
import {
  drawCartoonCloud,
  drawEarthyRiverbank,
  drawFacetedBoulder,
  drawLilyPad,
  drawNaturalPond,
  drawOrganicDirtCliff
} from './landscapePrimitives'

export function drawSlopingPastureAndPine(): HTMLCanvasElement {
  const [c, ctx] = createPlateCanvas()
  ctx.fillStyle = '#5ba532'
  ctx.beginPath()
  ctx.moveTo(0, H)
  ctx.lineTo(0, 720)
  ctx.quadraticCurveTo(W * 0.35, 680, W * 0.7, 600)
  ctx.lineTo(W, 520)
  ctx.lineTo(W, H)
  ctx.closePath()
  ctx.fill()

  drawPineTree(ctx, 360, 680, 260, 130)

  drawStylizedTree(ctx, 1420, 630, 360, 240, {
    seed: 331,
    curveDir: -1,
    foliage: { shadow: '#1b5e20', mid: '#388e3c', light: '#7cb342' }
  })
  return c
}

export function drawLagoonAndShore(): HTMLCanvasElement {
  const [c, ctx] = createPlateCanvas()
  const meadowTopY = 670

  const grassG = ctx.createLinearGradient(0, meadowTopY, 0, H)
  grassG.addColorStop(0, '#78c73b')
  grassG.addColorStop(0.5, '#5aa32a')
  grassG.addColorStop(1.0, '#3e7c1a')
  ctx.fillStyle = grassG
  ctx.fillRect(0, meadowTopY, W, H - meadowTopY)

  drawNaturalPond(ctx, 1200, 880, 520, 180, 999)
  return c
}

export function drawMidgroundBoulderClusters(): HTMLCanvasElement {
  const [c, ctx] = createPlateCanvas()

  drawFacetedBoulder(ctx, 1720, 820, 80, 55, 711)
  drawFacetedBoulder(ctx, 1860, 800, 110, 80, 712)
  drawFacetedBoulder(ctx, 2040, 830, 130, 90, 713)

  drawFacetedBoulder(ctx, 620, 810, 95, 68, 714)
  drawFacetedBoulder(ctx, 480, 830, 120, 85, 715)

  drawFoliageCloud(ctx, 840, 820, 140, 65, 831)
  drawFoliageCloud(ctx, 1540, 810, 150, 70, 832)
  return c
}

export function drawForegroundLagoonFraming(): HTMLCanvasElement {
  const [c, ctx] = createPlateCanvas()

  ctx.fillStyle = '#7a4e2a'
  ctx.beginPath()
  ctx.moveTo(-40, 40)
  ctx.quadraticCurveTo(240, 120, 580, 200)
  ctx.lineTo(560, 250)
  ctx.quadraticCurveTo(200, 190, -40, 120)
  ctx.closePath()
  ctx.fill()
  drawFoliageCloud(ctx, 320, 180, 340, 170, 941)
  drawFoliageCloud(ctx, 640, 220, 320, 160, 942)

  ctx.fillStyle = '#7a4e2a'
  ctx.beginPath()
  ctx.moveTo(W + 40, 40)
  ctx.quadraticCurveTo(W - 240, 120, W - 580, 200)
  ctx.lineTo(W - 560, 250)
  ctx.quadraticCurveTo(W - 200, 190, W + 40, 120)
  ctx.closePath()
  ctx.fill()
  drawFoliageCloud(ctx, W - 320, 180, 340, 170, 943)
  drawFoliageCloud(ctx, W - 640, 220, 320, 160, 944)

  drawFacetedBoulder(ctx, 280, 1100, 160, 115, 951)
  drawFacetedBoulder(ctx, 450, 1150, 130, 90, 952)
  drawFacetedBoulder(ctx, W - 280, 1100, 160, 115, 953)
  drawFacetedBoulder(ctx, W - 450, 1150, 130, 90, 954)

  drawFoliageCloud(ctx, 1200, 1180, 260, 90, 961)
  drawFoliageCloud(ctx, 880, 1190, 200, 80, 962)
  drawFoliageCloud(ctx, 1520, 1190, 200, 80, 963)
  return c
}

export function drawSunsetSky(): HTMLCanvasElement {
  const [c, ctx] = createPlateCanvas()
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#1a103c')
  g.addColorStop(0.32, '#511b5e')
  g.addColorStop(0.62, '#b7385a')
  g.addColorStop(0.82, '#f46c43')
  g.addColorStop(1.0, '#fed174')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  const sx = W * 0.65
  const sy = 680
  const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 550)
  glow.addColorStop(0, 'rgba(255, 252, 230, 0.98)')
  glow.addColorStop(0.15, 'rgba(255, 195, 105, 0.72)')
  glow.addColorStop(0.4, 'rgba(240, 100, 70, 0.22)')
  glow.addColorStop(1, 'rgba(180, 50, 80, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = '#fff7e6'
  ctx.beginPath()
  ctx.arc(sx, sy, 72, 0, Math.PI * 2)
  ctx.fill()

  drawCartoonCloud(ctx, 420, 260, 540, 160, 0.75)
  drawCartoonCloud(ctx, 1280, 210, 640, 180, 0.7)
  drawCartoonCloud(ctx, 2140, 250, 480, 150, 0.75)
  return c
}

export function drawTwilightMountains(): HTMLCanvasElement {
  const [c, ctx] = createPlateCanvas()
  ctx.fillStyle = '#5c2d68'
  ctx.beginPath()
  ctx.moveTo(0, H)
  ctx.lineTo(0, 560)
  ctx.quadraticCurveTo(W * 0.2, 410, W * 0.4, 520)
  ctx.quadraticCurveTo(W * 0.58, 390, W * 0.75, 540)
  ctx.quadraticCurveTo(W * 0.9, 450, W, 520)
  ctx.lineTo(W, H)
  ctx.closePath()
  ctx.fill()

  ctx.strokeStyle = 'rgba(255, 190, 120, 0.75)'
  ctx.lineWidth = 3.5
  ctx.beginPath()
  ctx.moveTo(0, 560)
  ctx.quadraticCurveTo(W * 0.2, 410, W * 0.4, 520)
  ctx.quadraticCurveTo(W * 0.58, 390, W * 0.75, 540)
  ctx.quadraticCurveTo(W * 0.9, 450, W, 520)
  ctx.stroke()
  return c
}

export function drawTwilightRiverFloor(): HTMLCanvasElement {
  const [c, ctx] = createPlateCanvas()
  const meadowTopY = 670
  const cliffTopY = 740
  const cliffH = 65
  const riverTopY = cliffTopY + cliffH

  const grassG = ctx.createLinearGradient(0, meadowTopY, 0, cliffTopY)
  grassG.addColorStop(0, '#5a6d2b')
  grassG.addColorStop(1, '#3d4d1d')
  ctx.fillStyle = grassG
  ctx.fillRect(0, meadowTopY, W, cliffTopY - meadowTopY)

  drawOrganicDirtCliff(ctx, cliffTopY, cliffH, 771, {
    soilTop: '#5c321d',
    soilBottom: '#32190d',
    grass: '#4d6824',
    grassShadow: '#283812'
  })

  const riverG = ctx.createLinearGradient(0, riverTopY, 0, H)
  riverG.addColorStop(0, '#e65100')
  riverG.addColorStop(0.4, '#ad1457')
  riverG.addColorStop(1.0, '#4a148c')
  ctx.fillStyle = riverG
  ctx.fillRect(0, riverTopY, W, H - riverTopY)

  ctx.strokeStyle = 'rgba(255, 215, 150, 0.5)'
  ctx.lineWidth = 2.5
  for (let y = riverTopY + 25; y < H - 20; y += 42) {
    for (let x = 40; x < W; x += 300) {
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.quadraticCurveTo(x + 80, y - 6, x + 160, y)
      ctx.stroke()
    }
  }

  drawLilyPad(ctx, 480, riverTopY + 50, 68, 25, false)
  drawLilyPad(ctx, 1180, riverTopY + 105, 88, 30, true)
  drawLilyPad(ctx, 1840, riverTopY + 65, 78, 28, true)
  return c
}

export function drawTwilightTrees(): HTMLCanvasElement {
  const [c, ctx] = createPlateCanvas()
  const groundY = 740

  drawStylizedTree(ctx, 460, groundY - 20, 680, 440, {
    seed: 881,
    curveDir: 1,
    trunkColor: '#5c321d',
    foliage: { shadow: '#1a2e12', mid: '#2d541e', light: '#4d8028', rim: '#ffab40' }
  })

  drawStylizedTree(ctx, 2180, groundY - 15, 720, 460, {
    seed: 882,
    curveDir: -1,
    trunkColor: '#5c321d',
    foliage: { shadow: '#1a2e12', mid: '#2d541e', light: '#4d8028', rim: '#ffab40' }
  })
  return c
}

export function drawTwilightForegroundFraming(): HTMLCanvasElement {
  const [c, ctx] = createPlateCanvas()

  ctx.fillStyle = '#4e2f17'
  ctx.beginPath()
  ctx.moveTo(10, H + 40)
  ctx.quadraticCurveTo(180, 850, 220, 480)
  ctx.quadraticCurveTo(240, 180, 40, -40)
  ctx.lineTo(-40, -40)
  ctx.lineTo(-40, H + 40)
  ctx.closePath()
  ctx.fill()

  ctx.strokeStyle = 'rgba(255, 171, 64, 0.65)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(180, 850)
  ctx.quadraticCurveTo(240, 480, 255, 180)
  ctx.stroke()

  drawFoliageCloud(ctx, 320, 180, 320, 170, 971, { shadow: '#14220e', mid: '#223d16', light: '#385c22', rim: '#ffab40' })
  drawFoliageCloud(ctx, 620, 220, 340, 180, 972, { shadow: '#14220e', mid: '#223d16', light: '#385c22', rim: '#ffab40' })

  ctx.fillStyle = '#4e2f17'
  ctx.beginPath()
  ctx.moveTo(W + 40, 40)
  ctx.quadraticCurveTo(W - 220, 140, W - 620, 220)
  ctx.lineTo(W - 600, 270)
  ctx.quadraticCurveTo(W - 180, 210, W + 40, 120)
  ctx.closePath()
  ctx.fill()

  drawFoliageCloud(ctx, W - 240, 180, 360, 180, 973, { shadow: '#14220e', mid: '#223d16', light: '#385c22', rim: '#ffab40' })
  drawFoliageCloud(ctx, W - 620, 240, 340, 170, 974, { shadow: '#14220e', mid: '#223d16', light: '#385c22', rim: '#ffab40' })

  drawEarthyRiverbank(ctx, 1040, 888, { soilTop: '#4a2512', soilBottom: '#281308' })

  drawBroadleafPlant(ctx, 320, 1220, 2.3, 1, { base: '#0f2911', half: '#19421c', vein: '#e69138' })
  drawBroadleafPlant(ctx, W - 260, 1220, 2.3, -1, { base: '#0f2911', half: '#19421c', vein: '#e69138' })

  return c
}

export function drawDriftingMistPlate(): HTMLCanvasElement {
  const [c, ctx] = createPlateCanvas()

  // 1. Base rolling haze band across the bottom/mid height
  const grad1 = ctx.createLinearGradient(0, H * 0.45, 0, H * 0.85)
  grad1.addColorStop(0, 'rgba(235, 245, 255, 0)')
  grad1.addColorStop(0.35, 'rgba(235, 248, 255, 0.42)')
  grad1.addColorStop(0.65, 'rgba(225, 240, 255, 0.35)')
  grad1.addColorStop(1, 'rgba(215, 235, 250, 0)')

  ctx.fillStyle = grad1
  ctx.beginPath()
  ctx.moveTo(0, H * 0.6)
  ctx.bezierCurveTo(W * 0.25, H * 0.48, W * 0.45, H * 0.68, W * 0.7, H * 0.52)
  ctx.bezierCurveTo(W * 0.85, H * 0.42, W * 0.95, H * 0.6, W, H * 0.55)
  ctx.lineTo(W, H * 0.82)
  ctx.bezierCurveTo(W * 0.8, H * 0.88, W * 0.5, H * 0.75, W * 0.3, H * 0.85)
  ctx.lineTo(0, H * 0.8)
  ctx.closePath()
  ctx.fill()

  // 2. Soft billowy mist puffs along the valley
  const puffs = [
    { x: W * 0.15, y: H * 0.58, rx: 320, ry: 90, a: 0.38 },
    { x: W * 0.35, y: H * 0.52, rx: 420, ry: 110, a: 0.45 },
    { x: W * 0.55, y: H * 0.62, rx: 380, ry: 100, a: 0.4 },
    { x: W * 0.75, y: H * 0.48, rx: 440, ry: 120, a: 0.48 },
    { x: W * 0.92, y: H * 0.56, rx: 340, ry: 95, a: 0.36 }
  ]
  for (const p of puffs) {
    const rad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.rx)
    rad.addColorStop(0, `rgba(245, 250, 255, ${p.a})`)
    rad.addColorStop(0.5, `rgba(235, 245, 255, ${p.a * 0.6})`)
    rad.addColorStop(1, 'rgba(230, 240, 255, 0)')
    ctx.fillStyle = rad
    ctx.beginPath()
    ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // 3. Lower riverbed wisps
  const grad2 = ctx.createLinearGradient(0, H * 0.65, 0, H * 0.95)
  grad2.addColorStop(0, 'rgba(240, 248, 255, 0)')
  grad2.addColorStop(0.4, 'rgba(230, 245, 255, 0.32)')
  grad2.addColorStop(1, 'rgba(220, 238, 252, 0)')
  ctx.fillStyle = grad2
  ctx.beginPath()
  ctx.moveTo(0, H * 0.72)
  ctx.bezierCurveTo(W * 0.3, H * 0.82, W * 0.6, H * 0.68, W, H * 0.76)
  ctx.lineTo(W, H * 0.92)
  ctx.bezierCurveTo(W * 0.7, H * 0.98, W * 0.3, H * 0.88, 0, H * 0.95)
  ctx.closePath()
  ctx.fill()

  return c
}

export function drawDriftingMountainClouds(): HTMLCanvasElement {
  const [c, ctx] = createPlateCanvas()

  // Mid-altitude cloud blanket drifting through mountain ridges
  const puffs = [
    { x: W * 0.1, y: H * 0.32, rx: 480, ry: 120, a: 0.42 },
    { x: W * 0.38, y: H * 0.38, rx: 550, ry: 140, a: 0.5 },
    { x: W * 0.65, y: H * 0.28, rx: 600, ry: 130, a: 0.45 },
    { x: W * 0.88, y: H * 0.36, rx: 450, ry: 110, a: 0.4 }
  ]
  for (const p of puffs) {
    const rad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.rx)
    rad.addColorStop(0, `rgba(255, 255, 255, ${p.a})`)
    rad.addColorStop(0.6, `rgba(240, 245, 252, ${p.a * 0.5})`)
    rad.addColorStop(1, 'rgba(235, 242, 250, 0)')
    ctx.fillStyle = rad
    ctx.beginPath()
    ctx.ellipse(p.x, p.y, p.rx, p.ry, -0.04, 0, Math.PI * 2)
    ctx.fill()
  }

  return c
}

export function drawDriftingTwilightMist(): HTMLCanvasElement {
  const [c, ctx] = createPlateCanvas()

  // Warm sunset tinted valley mist
  const puffs = [
    { x: W * 0.2, y: H * 0.55, rx: 420, ry: 110, a: 0.4 },
    { x: W * 0.45, y: H * 0.5, rx: 520, ry: 130, a: 0.48 },
    { x: W * 0.72, y: H * 0.58, rx: 480, ry: 120, a: 0.44 },
    { x: W * 0.95, y: H * 0.52, rx: 380, ry: 100, a: 0.38 }
  ]
  for (const p of puffs) {
    const rad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.rx)
    rad.addColorStop(0, `rgba(255, 224, 185, ${p.a})`)
    rad.addColorStop(0.5, `rgba(240, 190, 160, ${p.a * 0.55})`)
    rad.addColorStop(1, 'rgba(210, 150, 140, 0)')
    ctx.fillStyle = rad
    ctx.beginPath()
    ctx.ellipse(p.x, p.y, p.rx, p.ry, 0.02, 0, Math.PI * 2)
    ctx.fill()
  }

  return c
}
