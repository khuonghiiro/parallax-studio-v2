import type { DepthPortalConfig, LayerVirtualLight } from '@shared/types'
import { computeUnified25DLightAtOffset, hexToRgb01 } from '../../../engine/virtualLight'
import type { PadFittedBox } from './VirtualLightInteractivePad'

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

const VERT_SRC = `
attribute vec2 aPos;
varying vec2 vNorm;
void main() {
  vNorm = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`

const FRAG_SRC = `
precision highp float;
varying vec2 vNorm;

uniform vec4 uBox; // leftNorm, topNorm, wNorm, hNorm
uniform vec2 uWorldSize; // worldW, worldH
uniform vec2 uLightUV;
uniform vec3 uLightColor;
uniform float uIntensity;
uniform float uEffRadius;
uniform float uConeCos;
uniform vec2 uBeamDir;
uniform float uSoftness;
uniform float uBeamCurvature;
uniform float uAmbDim;

uniform vec2 uPortalUV;
uniform vec2 uPortalRadius;
uniform float uPortalDark;
uniform float uPortalFeather;
uniform vec3 uShadowTint;
uniform float uArchMode; // 1.0 = arch, 0.0 = circle/ellipse

vec2 evalUnifiedLight(
  float dxPx,
  float dyPx,
  float radiusPx,
  float intensity,
  float coneCos,
  vec2 bDir,
  float softness,
  float curvature
) {
  float safeR = max(16.0, radiusPx);
  float dist = length(vec2(dxPx, dyPx));
  float normD = dist / safeR;
  float soft = clamp(softness, 0.05, 1.0);
  float falloffExp = 1.15 + (1.0 - soft) * 1.15;
  float radial = clamp(1.0 - normD, 0.0, 1.0);
  float smoothRadial = radial * radial * (3.0 - 2.0 * radial);
  float falloff = pow(smoothRadial, falloffExp * 0.65);

  float coneFactor = 1.0;
  if (coneCos > -0.98 && dist > 0.5) {
    vec2 dir = vec2(dxPx, dyPx) / dist;
    float cosA = dot(dir, bDir);
    float halfSpanRad = acos(clamp(coneCos, -1.0, 1.0));
    float f = clamp(normD, 0.04, 1.25);
    float bowExp = max(0.35, 1.0 - curvature * 0.6);
    float bow = pow(f, bowExp);
    float scaleA = clamp(bow / max(0.08, f), 0.35, 1.75);
    float localHalfRad = clamp(halfSpanRad * scaleA, 0.08, 3.12);
    float effCos = cos(localHalfRad);
    float feather = max(0.04, (1.0 - effCos) * (0.28 + soft * 0.45));
    float t = clamp((cosA - (effCos - feather * 0.35)) / feather, 0.0, 1.0);
    coneFactor = t * t * (3.0 - 2.0 * t);
  }

  float coreSigma = max(10.0, safeR * 0.14);
  float wickCore = exp(-(dist * dist) / (2.0 * coreSigma * coreSigma)) * min(1.8, intensity * 0.95);
  float localLightHalo = falloff * coneFactor * intensity;
  return vec2(localLightHalo, wickCore);
}

void main() {
  float u = (vNorm.x - uBox.x) / max(0.001, uBox.z);
  float v = 1.0 - (vNorm.y - uBox.y) / max(0.001, uBox.w);
  bool inLayer = (u >= 0.0 && u <= 1.0 && v >= 0.0 && v <= 1.0);

  float caveAlpha = 0.0;
  if (inLayer && uPortalDark > 0.01) {
    float dx = (u - uPortalUV.x) / max(0.04, uPortalRadius.x);
    float dy = (v - uPortalUV.y) / max(0.04, uPortalRadius.y);
    if (uArchMode > 0.5) {
      dx /= 1.0 - clamp(dy, -0.6, 0.6) * 0.16;
      if (dy < 0.0) dx *= 0.92;
    }
    float d = length(vec2(dx, dy));
    float innerR = max(0.08, 1.0 - uPortalFeather * 0.88);
    if (d < 1.08) {
      float t = clamp((d - innerR) / max(0.06, 1.05 - innerR), 0.0, 1.0);
      float mask = 1.0 - t * t * (3.0 - 2.0 * t);
      caveAlpha = mask * uPortalDark;
    }
  }

  vec3 lightRGB = vec3(0.0);
  float lightA = 0.0;
  float rescue = 0.0;

  if (uIntensity > 0.01) {
    float dxPx = (u - uLightUV.x) * uWorldSize.x;
    float dyPx = (v - uLightUV.y) * uWorldSize.y;
    vec2 evalL = evalUnifiedLight(
      dxPx,
      dyPx,
      uEffRadius,
      uIntensity,
      uConeCos,
      uBeamDir,
      uSoftness,
      uBeamCurvature
    );
    float surf = inLayer ? evalL.x * 0.48 : 0.0;
    float air = evalL.x * (inLayer ? 0.52 : 0.72);
    float core = evalL.y * 0.95;
    float totalGlow = clamp(surf + air + core, 0.0, 1.35);
    rescue = clamp(evalL.x * 0.85 + evalL.y * 1.2, 0.0, 0.95);

    float whiteMix = clamp(evalL.y * 0.72, 0.0, 0.82);
    lightRGB = vec3(
      uLightColor.r * (1.0 - whiteMix) + whiteMix,
      uLightColor.g * (1.0 - whiteMix) + whiteMix * 0.98,
      uLightColor.b * (1.0 - whiteMix) + whiteMix * 0.92
    );
    lightA = clamp(totalGlow * 0.86, 0.0, 0.94);
  }

  float effCaveA = max(0.0, caveAlpha * (1.0 - rescue * 0.82));
  float ambDarkA = inLayer ? max(0.0, uAmbDim * (1.0 - rescue) * 0.62) : 0.0;
  float darkA = clamp(max(effCaveA, ambDarkA), 0.0, 0.92);

  float outA = clamp(darkA + lightA * (1.0 - darkA * 0.35), 0.0, 0.95);
  vec3 outRGB = vec3(0.0);
  if (outA > 0.002) {
    float darkWeight = (darkA * (1.0 - lightA * 0.65)) / outA;
    float lightWeight = clamp(1.0 - darkWeight, 0.0, 1.0);
    outRGB = uShadowTint * darkWeight + lightRGB * lightWeight;
  }

  gl_FragColor = vec4(clamp(outRGB, 0.0, 1.0), outA);
}
`

interface GlPadContext {
  gl: WebGLRenderingContext
  program: WebGLProgram
  vbo: WebGLBuffer
  aPos: number
  uniforms: Record<string, WebGLUniformLocation | null>
}

const glContextCache = new WeakMap<HTMLCanvasElement, GlPadContext | null>()

function getOrCreateGlContext(canvas: HTMLCanvasElement): GlPadContext | null {
  if (glContextCache.has(canvas)) {
    return glContextCache.get(canvas) ?? null
  }
  try {
    const gl = (canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: true
    }) ||
      canvas.getContext('experimental-webgl', {
        alpha: true,
        premultipliedAlpha: false
      })) as WebGLRenderingContext | null

    if (!gl) {
      glContextCache.set(canvas, null)
      return null
    }

    const compile = (type: number, src: string): WebGLShader | null => {
      const sh = gl.createShader(type)
      if (!sh) return null
      gl.shaderSource(sh, src)
      gl.compileShader(sh)
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        gl.deleteShader(sh)
        return null
      }
      return sh
    }

    const vs = compile(gl.VERTEX_SHADER, VERT_SRC)
    const fs = compile(gl.FRAGMENT_SHADER, FRAG_SRC)
    if (!vs || !fs) {
      glContextCache.set(canvas, null)
      return null
    }

    const program = gl.createProgram()
    if (!program) {
      glContextCache.set(canvas, null)
      return null
    }
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      glContextCache.set(canvas, null)
      return null
    }

    const vbo = gl.createBuffer()
    if (!vbo) {
      glContextCache.set(canvas, null)
      return null
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    )

    const aPos = gl.getAttribLocation(program, 'aPos')
    const uniformNames = [
      'uBox',
      'uWorldSize',
      'uLightUV',
      'uLightColor',
      'uIntensity',
      'uEffRadius',
      'uConeCos',
      'uBeamDir',
      'uSoftness',
      'uBeamCurvature',
      'uAmbDim',
      'uPortalUV',
      'uPortalRadius',
      'uPortalDark',
      'uPortalFeather',
      'uShadowTint',
      'uArchMode'
    ]
    const uniforms: Record<string, WebGLUniformLocation | null> = {}
    for (const name of uniformNames) {
      uniforms[name] = gl.getUniformLocation(program, name)
    }

    const ctxObj: GlPadContext = { gl, program, vbo, aPos, uniforms }
    glContextCache.set(canvas, ctxObj)
    return ctxObj
  } catch {
    glContextCache.set(canvas, null)
    return null
  }
}

export interface VirtualLightPadRenderParams {
  vlight: LayerVirtualLight
  isLightEnabled: boolean
  portal: DepthPortalConfig
  isPortalEnabled: boolean
  lightU: number
  lightV: number
  coneDeg: number
  beamRad: number
  beamCurvature: number
  radiusPx: number
  portalU: number
  portalV: number
  portalRx: number
  portalRy: number
  archShape: string
  box: PadFittedBox
  worldW: number
  worldH: number
}

/**
 * Render 2.5D Virtual Light + Cave Portal preview using GPU WebGL Fragment Shader (0.04ms/frame),
 * with automatic CPU 2D Canvas fallback for headless test environments.
 */
export function renderVirtualLightPadFrame(
  canvas: HTMLCanvasElement,
  params: VirtualLightPadRenderParams
): 'webgl' | '2d' {
  const {
    vlight,
    isLightEnabled,
    portal,
    isPortalEnabled,
    lightU,
    lightV,
    coneDeg,
    beamRad,
    beamCurvature,
    radiusPx,
    portalU,
    portalV,
    portalRx,
    portalRy,
    archShape,
    box,
    worldW,
    worldH
  } = params

  const [lr, lg, lb] = hexToRgb01(vlight.color || '#ff9d3b')
  const [sr, sg, sb] = hexToRgb01(portal.shadowTint || '#060812')
  const intensity = isLightEnabled ? clamp(vlight.intensity ?? 1.2, 0, 3) : 0
  const intensityReach = 0.65 + Math.pow(Math.max(intensity, 0.05), 0.65) * 0.42
  const effRadius = Math.max(24, radiusPx * intensityReach)
  const coneCos =
    coneDeg >= 355 ? -1 : Math.cos((clamp(coneDeg, 8, 355) * 0.5 * Math.PI) / 180)
  const bDir: [number, number] = [Math.cos(beamRad), Math.sin(beamRad)]
  const softness = clamp(vlight.softness ?? 0.68, 0.05, 1)
  const ambDim = isLightEnabled ? clamp(vlight.ambientDim ?? 0.22, 0, 0.92) : 0
  const pDark = isPortalEnabled ? clamp(portal.darkness ?? 0.78, 0, 1) : 0
  const pFeather = clamp(portal.feather ?? 0.55, 0.08, 0.98)

  const glCtx = getOrCreateGlContext(canvas)
  if (glCtx && !glCtx.gl.isContextLost()) {
    const { gl, program, vbo, aPos, uniforms } = glCtx
    const W = 192
    const H = 112
    if (canvas.width !== W) canvas.width = W
    if (canvas.height !== H) canvas.height = H

    gl.viewport(0, 0, W, H)
    gl.useProgram(program)
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    gl.uniform4f(uniforms.uBox, box.leftNorm, box.topNorm, box.wNorm, box.hNorm)
    gl.uniform2f(uniforms.uWorldSize, worldW, worldH)
    gl.uniform2f(uniforms.uLightUV, lightU, lightV)
    gl.uniform3f(uniforms.uLightColor, lr, lg, lb)
    gl.uniform1f(uniforms.uIntensity, intensity)
    gl.uniform1f(uniforms.uEffRadius, effRadius)
    gl.uniform1f(uniforms.uConeCos, coneCos)
    gl.uniform2f(uniforms.uBeamDir, bDir[0], bDir[1])
    gl.uniform1f(uniforms.uSoftness, softness)
    gl.uniform1f(uniforms.uBeamCurvature, beamCurvature)
    gl.uniform1f(uniforms.uAmbDim, ambDim)

    gl.uniform2f(uniforms.uPortalUV, portalU, portalV)
    gl.uniform2f(uniforms.uPortalRadius, portalRx, portalRy)
    gl.uniform1f(uniforms.uPortalDark, pDark)
    gl.uniform1f(uniforms.uPortalFeather, pFeather)
    gl.uniform3f(uniforms.uShadowTint, sr, sg, sb)
    gl.uniform1f(uniforms.uArchMode, archShape === 'arch' ? 1.0 : 0.0)

    gl.drawArrays(gl.TRIANGLES, 0, 6)
    return 'webgl'
  }

  // Fallback 2D Canvas for environments without WebGL
  const ctx = canvas.getContext('2d')
  if (!ctx) return '2d'

  const W = 96
  const H = 56
  if (canvas.width !== W) canvas.width = W
  if (canvas.height !== H) canvas.height = H

  const imgData = ctx.createImageData(W, H)
  const data = imgData.data

  for (let py = 0; py < H; py++) {
    const normY = (py + 0.5) / H
    for (let px = 0; px < W; px++) {
      const normX = (px + 0.5) / W
      const u = (normX - box.leftNorm) / box.wNorm
      const v = 1 - (normY - box.topNorm) / box.hNorm
      const inLayer = u >= 0 && u <= 1 && v >= 0 && v <= 1

      let caveAlpha = 0
      if (inLayer && pDark > 0.01) {
        let dx = (u - portalU) / Math.max(0.04, portalRx)
        const dy = (v - portalV) / Math.max(0.04, portalRy)
        if (archShape === 'arch') {
          dx /= 1 - clamp(dy, -0.6, 0.6) * 0.16
          if (dy < 0) dx *= 0.92
        }
        const d = Math.hypot(dx, dy)
        const innerR = Math.max(0.08, 1 - pFeather * 0.88)
        if (d < 1.08) {
          const t = clamp((d - innerR) / Math.max(0.06, 1.05 - innerR), 0, 1)
          const mask = 1 - t * t * (3 - 2 * t)
          caveAlpha = mask * pDark
        }
      }

      let lightR = 0
      let lightG = 0
      let lightB = 0
      let lightA = 0
      let rescue = 0

      if (intensity > 0.01) {
        const dxPx = (u - lightU) * worldW
        const dyPx = (v - lightV) * worldH
        const evalL = computeUnified25DLightAtOffset(
          dxPx,
          dyPx,
          effRadius,
          intensity,
          coneCos,
          bDir,
          softness,
          beamCurvature
        )
        const surf = inLayer ? evalL.localLightHalo * 0.48 : 0
        const air = evalL.localLightHalo * (inLayer ? 0.52 : 0.72)
        const core = evalL.wickCore * 0.95
        const totalGlow = clamp(surf + air + core, 0, 1.35)
        rescue = clamp(evalL.localLightHalo * 0.85 + evalL.wickCore * 1.2, 0, 0.95)

        const whiteMix = clamp(evalL.wickCore * 0.72, 0, 0.82)
        lightR = lr * (1 - whiteMix) + whiteMix
        lightG = lg * (1 - whiteMix) + whiteMix * 0.98
        lightB = lb * (1 - whiteMix) + whiteMix * 0.92
        lightA = clamp(totalGlow * 0.86, 0, 0.94)
      }

      const effCaveA = Math.max(0, caveAlpha * (1 - rescue * 0.82))
      const ambDarkA = inLayer ? Math.max(0, ambDim * (1 - rescue) * 0.62) : 0
      const darkA = clamp(Math.max(effCaveA, ambDarkA), 0, 0.92)

      const outA = clamp(darkA + lightA * (1 - darkA * 0.35), 0, 0.95)
      let outR = 0
      let outG = 0
      let outB = 0
      if (outA > 0.002) {
        const darkWeight = (darkA * (1 - lightA * 0.65)) / outA
        const lightWeight = clamp(1 - darkWeight, 0, 1)
        outR = sr * darkWeight + lightR * lightWeight
        outG = sg * darkWeight + lightG * lightWeight
        outB = sb * darkWeight + lightB * lightWeight
      }

      const idx = (py * W + px) * 4
      data[idx] = Math.round(clamp(outR, 0, 1) * 255)
      data[idx + 1] = Math.round(clamp(outG, 0, 1) * 255)
      data[idx + 2] = Math.round(clamp(outB, 0, 1) * 255)
      data[idx + 3] = Math.round(outA * 255)
    }
  }

  ctx.putImageData(imgData, 0, 0)
  return '2d'
}
