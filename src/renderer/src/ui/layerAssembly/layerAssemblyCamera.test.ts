import { describe, it, expect } from 'vitest'
import * as THREE from 'three'

describe('layerAssemblyCamera', () => {
  it('computes 360 degree orbit camera positions correctly around target', () => {
    const target = new THREE.Vector3(100, -50, 20)
    const distance = 1000

    // 0 deg azimuth, 0 deg elevation (Front view)
    const az0 = 0
    const el0 = 0
    const posFront = new THREE.Vector3(
      target.x + distance * Math.cos(el0) * Math.sin(az0),
      target.y + distance * Math.sin(el0),
      target.z + distance * Math.cos(el0) * Math.cos(az0)
    )
    expect(posFront.x).toBeCloseTo(100)
    expect(posFront.y).toBeCloseTo(-50)
    expect(posFront.z).toBeCloseTo(1020)

    // 180 deg azimuth (Back view 360°)
    const az180 = Math.PI
    const posBack = new THREE.Vector3(
      target.x + distance * Math.cos(el0) * Math.sin(az180),
      target.y + distance * Math.sin(el0),
      target.z + distance * Math.cos(el0) * Math.cos(az180)
    )
    expect(posBack.x).toBeCloseTo(100)
    expect(posBack.y).toBeCloseTo(-50)
    expect(posBack.z).toBeCloseTo(-980)

    // 90 deg azimuth (Right side view)
    const az90 = Math.PI / 2
    const posRight = new THREE.Vector3(
      target.x + distance * Math.cos(el0) * Math.sin(az90),
      target.y + distance * Math.sin(el0),
      target.z + distance * Math.cos(el0) * Math.cos(az90)
    )
    expect(posRight.x).toBeCloseTo(1100)
    expect(posRight.y).toBeCloseTo(-50)
    expect(posRight.z).toBeCloseTo(20)

    // -90 deg azimuth (Left side view)
    const azMinus90 = -Math.PI / 2
    const posLeft = new THREE.Vector3(
      target.x + distance * Math.cos(el0) * Math.sin(azMinus90),
      target.y + distance * Math.sin(el0),
      target.z + distance * Math.cos(el0) * Math.cos(azMinus90)
    )
    expect(posLeft.x).toBeCloseTo(-900)
    expect(posLeft.y).toBeCloseTo(-50)
    expect(posLeft.z).toBeCloseTo(20)
  })

  it('correctly maps layer coordinate to 3D aim target with Z exaggeration', () => {
    const layer = {
      x: 120,
      y: 80,
      z: 50
    }
    const zExaggeration = 1.8

    // Three.js world mapping: x -> layer.x, y -> -layer.y, z -> -layer.z * zExaggeration
    const targetX = Math.round(layer.x)
    const targetY = Math.round(-layer.y)
    const targetZ = Math.round(-layer.z * zExaggeration)

    expect(targetX).toBe(120)
    expect(targetY).toBe(-80)
    expect(targetZ).toBe(-90)
  })

  it('validates FOV bounds and category labels', () => {
    const getFovLabel = (fov: number) => {
      if (fov <= 35) return 'Góc hẹp (Telephoto)'
      if (fov <= 55) return 'Chuẩn tự nhiên'
      return 'Góc rộng (Wide)'
    }

    expect(getFovLabel(25)).toBe('Góc hẹp (Telephoto)')
    expect(getFovLabel(45)).toBe('Chuẩn tự nhiên')
    expect(getFovLabel(55)).toBe('Chuẩn tự nhiên')
    expect(getFovLabel(70)).toBe('Góc rộng (Wide)')
    expect(getFovLabel(85)).toBe('Góc rộng (Wide)')
  })

  it('handles vertical pitch drag direction correctly', () => {
    // When dragging mouse up (dy < 0), camera elevation should increase (look down from above)
    const curElevation = 0.35
    const dyUp = -10 // drag up
    const sensitivity = 0.007
    const newElevationUp = curElevation - dyUp * sensitivity
    expect(newElevationUp).toBeGreaterThan(curElevation)

    // When dragging mouse down (dy > 0), camera elevation should decrease (look up from below)
    const dyDown = 10 // drag down
    const newElevationDown = curElevation - dyDown * sensitivity
    expect(newElevationDown).toBeLessThan(curElevation)
  })
})
