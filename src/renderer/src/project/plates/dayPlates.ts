import { mulberry32 } from '../../animation/math'
import { createPlateCanvas, W, H } from './canvas'
import { drawBroadleafPlant, drawFoliageCloud, drawStylizedTree, drawUprightTieredTree } from './treePrimitives'
import {
  drawCartoonCloud,
  drawCenterIsland,
  drawEarthyRiverbank,
  drawFacetedBoulder,
  drawLilyPad,
  drawOrganicDirtCliff
} from './landscapePrimitives'

export function drawSunnySky(): HTMLCanvasElement {
  const [c, ctx] = createPlateCanvas()
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#1e88e5')
  g.addColorStop(0.35, '#42a5f5')
  g.addColorStop(0.7, '#90caf9')
  g.addColorStop(1.0, '#e3f2fd')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  drawCartoonCloud(ctx, 360, 240, 480, 150, 0.95)
  drawCartoonCloud(ctx, 1100, 180, 640, 190, 0.9)
  drawCartoonCloud(ctx, 1880, 230, 520, 160, 0.95)
  drawCartoonCloud(ctx, 2380, 190, 400, 140, 0.85)
  return c
}

export function drawDistantMountains(): HTMLCanvasElement {
  const [c, ctx] = createPlateCanvas()
  ctx.fillStyle = '#79a8cb'
  ctx.beginPath()
  ctx.moveTo(0, H)
  ctx.lineTo(0, 560)
  ctx.quadraticCurveTo(W * 0.18, 410, W * 0.35, 520)
  ctx.quadraticCurveTo(W * 0.52, 380, W * 0.72, 530)
  ctx.quadraticCurveTo(W * 0.88, 420, W, 500)
  ctx.lineTo(W, H)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = '#548ea8'
  ctx.beginPath()
  ctx.moveTo(0, H)
  ctx.lineTo(0, 610)
  ctx.quadraticCurveTo(W * 0.16, 500, W * 0.32, 590)
  ctx.quadraticCurveTo(W * 0.48, 480, W * 0.66, 610)
  ctx.quadraticCurveTo(W * 0.84, 510, W, 580)
  ctx.lineTo(W, H)
  ctx.closePath()
  ctx.fill()

  const haze = ctx.createLinearGradient(0, 580, 0, H)
  haze.addColorStop(0, 'rgba(227, 242, 253, 0)')
  haze.addColorStop(1, 'rgba(227, 242, 253, 0.75)')
  ctx.fillStyle = haze
  ctx.fillRect(0, 580, W, H - 580)
  return c
}

export function drawRollingGreenHills(): HTMLCanvasElement {
  const [c, ctx] = createPlateCanvas()
  ctx.fillStyle = '#55a038'
  ctx.beginPath()
  ctx.moveTo(0, H)
  ctx.lineTo(0, 690)
  ctx.quadraticCurveTo(W * 0.28, 570, W * 0.6, 670)
  ctx.quadraticCurveTo(W * 0.82, 590, W, 650)
  ctx.lineTo(W, H)
  ctx.closePath()
  ctx.fill()

  drawFoliageCloud(ctx, 420, 630, 130, 55, 111)
  drawFoliageCloud(ctx, 1180, 610, 150, 60, 222)
  drawFoliageCloud(ctx, 1980, 640, 140, 56, 333)

  ctx.fillStyle = '#6bbd3a'
  ctx.beginPath()
  ctx.moveTo(0, H)
  ctx.lineTo(0, 750)
  ctx.quadraticCurveTo(W * 0.35, 650, W * 0.72, 770)
  ctx.quadraticCurveTo(W * 0.9, 710, W, 750)
  ctx.lineTo(W, H)
  ctx.closePath()
  ctx.fill()
  return c
}

export function drawRiverAndMeadowFloor(): HTMLCanvasElement {
  const [c, ctx] = createPlateCanvas()
  const meadowTopY = 670
  const cliffTopY = 740
  const cliffH = 65
  const riverTopY = cliffTopY + cliffH

  const grassG = ctx.createLinearGradient(0, meadowTopY, 0, cliffTopY)
  grassG.addColorStop(0, '#7ac83d')
  grassG.addColorStop(1, '#5ca72c')
  ctx.fillStyle = grassG
  ctx.fillRect(0, meadowTopY, W, cliffTopY - meadowTopY)

  ctx.strokeStyle = '#43a047'
  ctx.lineWidth = 2.5
  const randTuft = mulberry32(1010)
  for (let x = 60; x < W - 60; x += 85) {
    const ty = meadowTopY + 12 + randTuft() * 35
    ctx.beginPath()
    ctx.moveTo(x - 8, ty + 12)
    ctx.quadraticCurveTo(x - 12, ty, x - 16, ty - 12)
    ctx.moveTo(x, ty + 12)
    ctx.quadraticCurveTo(x, ty - 2, x - 2, ty - 16)
    ctx.moveTo(x + 8, ty + 12)
    ctx.quadraticCurveTo(x + 12, ty, x + 16, ty - 12)
    ctx.stroke()
  }

  drawFacetedBoulder(ctx, 760, cliffTopY - 26, 68, 46, 101)
  drawFacetedBoulder(ctx, 1340, cliffTopY - 22, 54, 38, 202)
  drawFacetedBoulder(ctx, 1860, cliffTopY - 28, 62, 44, 303)

  drawOrganicDirtCliff(ctx, cliffTopY, cliffH, 555)

  const riverG = ctx.createLinearGradient(0, riverTopY, 0, H)
  riverG.addColorStop(0, '#38bdf8')
  riverG.addColorStop(0.45, '#0ea5e9')
  riverG.addColorStop(1.0, '#0284c7')
  ctx.fillStyle = riverG
  ctx.fillRect(0, riverTopY, W, H - riverTopY)

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
  ctx.lineWidth = 2.5
  for (let y = riverTopY + 25; y < H - 20; y += 38) {
    for (let x = 40; x < W; x += 300) {
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.quadraticCurveTo(x + 80, y - 6, x + 160, y)
      ctx.stroke()
    }
  }

  drawLilyPad(ctx, 450, riverTopY + 45, 68, 25, false)
  drawLilyPad(ctx, 1120, riverTopY + 95, 88, 30, true)
  drawLilyPad(ctx, 1880, riverTopY + 55, 78, 28, true)
  drawLilyPad(ctx, 1520, riverTopY + 110, 70, 24, false)
  return c
}

export function drawMidgroundTrees(): HTMLCanvasElement {
  const [c, ctx] = createPlateCanvas()
  const groundY = 740

  drawStylizedTree(ctx, 460, groundY - 20, 680, 440, {
    seed: 512,
    curveDir: 1,
    foliage: { shadow: '#1b5e20', mid: '#388e3c', light: '#7cb342', rim: '#aed581' }
  })

  drawStylizedTree(ctx, 2180, groundY - 15, 720, 460, {
    seed: 714,
    curveDir: -1,
    foliage: { shadow: '#1b5e20', mid: '#388e3c', light: '#7cb342', rim: '#aed581' }
  })

  drawFoliageCloud(ctx, 280, groundY - 30, 95, 52, 881)
  drawFoliageCloud(ctx, 620, groundY - 25, 115, 58, 882)
  drawFoliageCloud(ctx, 2020, groundY - 25, 105, 55, 883)
  drawFoliageCloud(ctx, 2380, groundY - 30, 120, 60, 884)

  drawFacetedBoulder(ctx, 330, groundY - 10, 52, 38, 404)
  drawFacetedBoulder(ctx, 2320, groundY - 10, 58, 42, 505)
  return c
}

export function drawForegroundRiverbankFraming(): HTMLCanvasElement {
  const [c, ctx] = createPlateCanvas()

  ctx.fillStyle = '#7a4e2a'
  ctx.beginPath()
  ctx.moveTo(10, H + 40)
  ctx.quadraticCurveTo(180, 850, 220, 480)
  ctx.quadraticCurveTo(240, 180, 40, -40)
  ctx.lineTo(-40, -40)
  ctx.lineTo(-40, H + 40)
  ctx.closePath()
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(220, 820)
  ctx.quadraticCurveTo(340, 980, 480, 1180)
  ctx.lineTo(200, 1240)
  ctx.lineTo(100, 1080)
  ctx.closePath()
  ctx.fill()

  ctx.strokeStyle = '#4e2f17'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(80, 1150)
  ctx.quadraticCurveTo(190, 850, 210, 480)
  ctx.stroke()

  ctx.strokeStyle = '#9c683d'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(120, 1150)
  ctx.quadraticCurveTo(220, 850, 235, 480)
  ctx.stroke()

  drawFoliageCloud(ctx, 320, 180, 320, 170, 901)
  drawFoliageCloud(ctx, 620, 220, 340, 180, 902)

  ctx.fillStyle = '#7a4e2a'
  ctx.beginPath()
  ctx.moveTo(W + 40, 40)
  ctx.quadraticCurveTo(W - 220, 140, W - 620, 220)
  ctx.lineTo(W - 600, 270)
  ctx.quadraticCurveTo(W - 180, 210, W + 40, 120)
  ctx.closePath()
  ctx.fill()

  drawFoliageCloud(ctx, W - 240, 180, 360, 180, 904)
  drawFoliageCloud(ctx, W - 620, 240, 340, 170, 905)

  drawEarthyRiverbank(ctx, 1040, 777)
  drawFacetedBoulder(ctx, 1840, 1110, 140, 90, 778, { top: '#e0c8b0', mid: '#b08b68', shadow: '#6a4a2e' })

  drawBroadleafPlant(ctx, 320, 1220, 2.3, 1)
  drawBroadleafPlant(ctx, W - 260, 1220, 2.3, -1)

  return c
}

export function drawPastelSky(): HTMLCanvasElement {
  const [c, ctx] = createPlateCanvas()
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#90caf9')
  g.addColorStop(0.45, '#bbdefb')
  g.addColorStop(0.85, '#e3f2fd')
  g.addColorStop(1.0, '#f0f9ff')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  drawCartoonCloud(ctx, 420, 220, 520, 160, 0.9)
  drawCartoonCloud(ctx, 1240, 170, 660, 190, 0.85)
  drawCartoonCloud(ctx, 2020, 240, 480, 150, 0.9)
  return c
}

export function drawPurpleMountainPeaks(): HTMLCanvasElement {
  const [c, ctx] = createPlateCanvas()
  ctx.fillStyle = '#8f9db5'
  ctx.beginPath()
  ctx.moveTo(0, H)
  ctx.lineTo(0, 560)
  ctx.quadraticCurveTo(W * 0.22, 360, W * 0.42, 510)
  ctx.quadraticCurveTo(W * 0.6, 340, W * 0.78, 520)
  ctx.quadraticCurveTo(W * 0.9, 430, W, 500)
  ctx.lineTo(W, H)
  ctx.closePath()
  ctx.fill()

  const haze = ctx.createLinearGradient(0, 520, 0, H)
  haze.addColorStop(0, 'rgba(240, 249, 255, 0)')
  haze.addColorStop(1, 'rgba(240, 249, 255, 0.8)')
  ctx.fillStyle = haze
  ctx.fillRect(0, 520, W, H - 520)
  return c
}

export function drawRollingHillsAndHedges(): HTMLCanvasElement {
  const [c, ctx] = createPlateCanvas()
  ctx.fillStyle = '#61aa34'
  ctx.beginPath()
  ctx.moveTo(0, H)
  ctx.lineTo(0, 680)
  ctx.quadraticCurveTo(W * 0.3, 580, W * 0.65, 680)
  ctx.quadraticCurveTo(W * 0.85, 610, W, 670)
  ctx.lineTo(W, H)
  ctx.closePath()
  ctx.fill()

  drawFoliageCloud(ctx, 360, 640, 180, 75, 411)
  drawFoliageCloud(ctx, 740, 660, 200, 80, 412)
  drawFoliageCloud(ctx, 1680, 670, 210, 85, 413)
  drawFoliageCloud(ctx, 2080, 650, 190, 78, 414)
  return c
}

export function drawCenterIslandPond(): HTMLCanvasElement {
  const [c, ctx] = createPlateCanvas()
  const meadowTopY = 670
  const pondTopY = 740

  const grassG = ctx.createLinearGradient(0, meadowTopY, 0, pondTopY)
  grassG.addColorStop(0, '#7ac83d')
  grassG.addColorStop(1, '#5ca72c')
  ctx.fillStyle = grassG
  ctx.fillRect(0, meadowTopY, W, pondTopY - meadowTopY)

  const pondG = ctx.createLinearGradient(0, pondTopY, 0, H)
  pondG.addColorStop(0, '#38bdf8')
  pondG.addColorStop(0.5, '#0ea5e9')
  pondG.addColorStop(1.0, '#0284c7')
  ctx.fillStyle = pondG
  ctx.fillRect(0, pondTopY, W, H - pondTopY)

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)'
  ctx.lineWidth = 2.5
  for (let y = pondTopY + 25; y < H - 20; y += 42) {
    for (let x = 60; x < W; x += 320) {
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.quadraticCurveTo(x + 70, y - 6, x + 140, y)
      ctx.stroke()
    }
  }

  drawCenterIsland(ctx, 1200, 870, 260, 110, 80)
  return c
}

export function drawIslandPondTrees(): HTMLCanvasElement {
  const [c, ctx] = createPlateCanvas()
  const groundY = 740

  drawStylizedTree(ctx, 420, groundY - 15, 710, 460, {
    seed: 611,
    curveDir: 1,
    foliage: { shadow: '#1b5e20', mid: '#388e3c', light: '#7cb342', rim: '#c8e6c9' }
  })

  drawUprightTieredTree(ctx, 2140, groundY - 10, 760, 440, {
    seed: 622,
    foliage: { shadow: '#1b5e20', mid: '#388e3c', light: '#7cb342', rim: '#c8e6c9' }
  })

  drawFacetedBoulder(ctx, 580, groundY + 10, 95, 65, 801)
  drawFacetedBoulder(ctx, 720, groundY + 25, 75, 52, 802)
  return c
}

export function drawForegroundBroadleafFraming(): HTMLCanvasElement {
  const [c, ctx] = createPlateCanvas()

  drawFoliageCloud(ctx, 240, 160, 320, 160, 911)
  drawFoliageCloud(ctx, 600, 200, 340, 170, 912)

  drawFoliageCloud(ctx, W - 240, 170, 340, 170, 913)
  drawFoliageCloud(ctx, W - 580, 210, 320, 160, 914)

  ctx.fillStyle = '#4a8e1b'
  ctx.beginPath()
  ctx.moveTo(0, H)
  ctx.lineTo(0, 1140)
  ctx.quadraticCurveTo(W * 0.3, 1080, W * 0.5, 1120)
  ctx.quadraticCurveTo(W * 0.8, 1080, W, 1140)
  ctx.lineTo(W, H)
  ctx.closePath()
  ctx.fill()

  drawFacetedBoulder(ctx, 260, 1120, 150, 105, 931)
  drawFacetedBoulder(ctx, 420, 1150, 120, 85, 932)
  drawFacetedBoulder(ctx, W - 260, 1120, 150, 105, 933)
  drawFacetedBoulder(ctx, W - 420, 1150, 120, 85, 934)

  drawBroadleafPlant(ctx, 160, 1230, 2.6, 1)
  drawBroadleafPlant(ctx, 320, 1250, 2.1, 1)
  drawBroadleafPlant(ctx, W - 160, 1230, 2.6, -1)
  drawBroadleafPlant(ctx, W - 320, 1250, 2.1, -1)

  return c
}
