import { describe, expect, it } from 'vitest'
import {
  hexToHsv,
  hexToRgb,
  hsvToHex,
  hsvToRgb,
  isValidHex,
  normalizeHex,
  rgbToHex,
  rgbToHsv
} from './colorMath'

describe('colorMath', () => {
  it('validates and normalizes hex strings', () => {
    expect(isValidHex('#fff')).toBe(true)
    expect(isValidHex('fff')).toBe(true)
    expect(isValidHex('#123456')).toBe(true)
    expect(isValidHex('#xyz')).toBe(false)
    expect(isValidHex('#12345')).toBe(false)

    expect(normalizeHex('#fff')).toBe('#ffffff')
    expect(normalizeHex('abc')).toBe('#aabbcc')
    expect(normalizeHex('#1A2B3C')).toBe('#1a2b3c')
    expect(normalizeHex('invalid', '#000000')).toBe('#000000')
  })

  it('converts hex to rgb and rgb to hex', () => {
    expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 })
    expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 })
    expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 })
    expect(hexToRgb('#00ff00')).toEqual({ r: 0, g: 255, b: 0 })
    expect(hexToRgb('#0000ff')).toEqual({ r: 0, g: 0, b: 255 })

    expect(rgbToHex(255, 255, 255)).toBe('#ffffff')
    expect(rgbToHex(0, 0, 0)).toBe('#000000')
    expect(rgbToHex(255, 0, 0)).toBe('#ff0000')
    expect(rgbToHex(0, 255, 0)).toBe('#00ff00')
    expect(rgbToHex(0, 0, 255)).toBe('#0000ff')
  })

  it('converts between rgb and hsv', () => {
    const redHsv = rgbToHsv(255, 0, 0)
    expect(redHsv.h).toBe(0)
    expect(redHsv.s).toBe(1)
    expect(redHsv.v).toBe(1)

    const greenHsv = rgbToHsv(0, 255, 0)
    expect(greenHsv.h).toBe(120)
    expect(greenHsv.s).toBe(1)
    expect(greenHsv.v).toBe(1)

    const blueHsv = rgbToHsv(0, 0, 255)
    expect(blueHsv.h).toBe(240)
    expect(blueHsv.s).toBe(1)
    expect(blueHsv.v).toBe(1)

    const whiteHsv = rgbToHsv(255, 255, 255)
    expect(whiteHsv.s).toBe(0)
    expect(whiteHsv.v).toBe(1)

    const blackHsv = rgbToHsv(0, 0, 0)
    expect(blackHsv.v).toBe(0)

    expect(hsvToRgb(0, 1, 1)).toEqual({ r: 255, g: 0, b: 0 })
    expect(hsvToRgb(120, 1, 1)).toEqual({ r: 0, g: 255, b: 0 })
    expect(hsvToRgb(240, 1, 1)).toEqual({ r: 0, g: 0, b: 255 })
  })

  it('converts hex to hsv and back roundtrip', () => {
    const testColors = ['#ff0000', '#00ff00', '#0000ff', '#ffffff', '#000000', '#141414', '#3dd6f5']
    for (const hex of testColors) {
      const hsv = hexToHsv(hex)
      const resHex = hsvToHex(hsv.h, hsv.s, hsv.v)
      expect(resHex).toBe(hex)
    }
  })
})
