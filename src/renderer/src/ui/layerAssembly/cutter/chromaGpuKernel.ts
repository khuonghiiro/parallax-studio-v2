/**
 * Kernel GPU (WebGL2) cho bước tách nền chạy độc lập từng pixel: giải pha màu (`analyzeChromaAlpha`)
 * và alpha matte (`evalChromaMatte`). Các bước cần lan toả toàn ảnh (loang nền ngoài, lọc vụn, làm mềm
 * biên) vẫn chạy trên CPU vì không song song hoá theo pixel được.
 *
 * Chạy đồng bộ (readPixels) để giữ nguyên API của `processAdvancedChromaPixelData`; dùng được ở cả main
 * thread lẫn Web Worker (OffscreenCanvas). Không có WebGL2 / EXT_color_buffer_float (ví dụ Vitest/Node),
 * ảnh quá nhỏ hoặc quá lớn → trả về `null` để dùng đường CPU. Hằng số lấy từ đúng các hàm build params
 * của CPU nên hai đường cho kết quả khớp (lệch tối đa ±1 mức alpha do làm tròn float32).
 */
import type { ChromaKeySettings } from './types'
import { buildChromaMatteParams, type RgbColor } from './chromaMatte'
import {
  buildChromaAnalysisParams,
  finalizeChromaAnalysis,
  type ChromaAlphaAnalysis
} from './chromaShadowExtractor'

export interface ChromaGpuResult {
  analysis: ChromaAlphaAnalysis
  /** Alpha matte 0..255 theo alpha gốc của pixel (0 với pixel gần trong suốt) */
  matte: Uint8Array
}

/** Ảnh nhỏ hơn ngưỡng này chạy CPU nhanh hơn chi phí upload / readback. */
export const CHROMA_GPU_MIN_PIXELS = 512 * 512
/** Số pixel mỗi dải đọc về (RGBA32F = 16 byte/pixel → ~16 MB mỗi dải). */
const STRIP_PIXELS = 1 << 20

const VERT = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`

const FRAG = `#version 300 es
precision highp float;
precision highp int;
precision highp usampler2D;
uniform usampler2D uSrc;
uniform int uRowOffset;
uniform vec3 uKey;
uniform vec3 uInvPos;
uniform vec3 uInvNeg;
uniform vec3 uKc;
uniform float uKcLenSq;
uniform bool uChromatic;
uniform float uAnalysisDetail;
uniform int uShadowType;
uniform int uMode;
uniform float uKeyDominance;
uniform float uKMean;
uniform float uTolFactor;
uniform float uMatteDetail;
uniform float uHard;
uniform float uTw;
uniform float uHardEnd;
out vec4 outColor;

float chromaProjection(vec3 c) {
  float cMean = (c.r + c.g + c.b) / 3.0;
  return clamp(((c.r - cMean) * uKc.r + (c.g - cMean) * uKc.g + (c.b - cMean) * uKc.b) / uKcLenSq, 0.0, 1.0);
}

float neutralBoost(vec3 c, float dpScale, float kEff, float kOpp, float kHead) {
  vec3 d = c - uKey;
  float meanD = (d.r + d.g + d.b) / 3.0;
  vec3 cd = d - meanD;
  float effChroma = max(0.0, sqrt(cd.r * cd.r + cd.g * cd.g + cd.b * cd.b) - 2.2);
  float maxPos = max(0.0, max(d.r, max(d.g, d.b)));
  float maxNeg = max(0.0, max(-d.r, max(-d.g, -d.b)));
  float oppPol = (maxPos > 1.5 && maxNeg > 1.5) ? min(maxPos, maxNeg) : 0.0;
  float head = 0.0;
  if (kHead > 0.0) {
    if (uKMean >= 185.0 && uKMean <= 238.0 && meanD > 5.0) head = ((meanD - 5.0) / max(18.0, 255.0 - uKMean)) * 45.0;
    else if (uKMean >= 17.0 && uKMean <= 70.0 && -meanD > 5.0) head = ((-meanD - 5.0) / max(18.0, uKMean)) * 45.0;
  }
  return (effChroma * kEff + oppPol * kOpp + head * kHead) * dpScale;
}

float keyDistance(vec3 c) {
  if (uMode == 0) {
    vec3 d = c - uKey;
    return sqrt(d.r * d.r + d.g * d.g + d.b * d.b);
  }
  bool green = uMode == 1;
  float keyed = green ? c.g : c.b;
  float otherB = green ? c.b : c.g;
  float cd = keyed - (green ? uKey.g : uKey.b);
  float oa = c.r - uKey.r;
  float ob = otherB - (green ? uKey.b : uKey.g);
  float raw = sqrt(cd * cd * 0.48 + oa * oa * 0.28 + ob * ob * 0.24);
  float dominanceMatch = max(0.0, min(keyed - max(c.r, otherB), uKeyDominance) - 8.0);
  return max(0.0, raw - dominanceMatch * 0.22);
}

void main() {
  ivec2 pc = ivec2(gl_FragCoord.xy);
  pc.y += uRowOffset;
  uvec4 px = texelFetch(uSrc, pc, 0);
  if (px.a < 15u) { outColor = vec4(0.0); return; }
  vec3 c = vec3(px.rgb);
  float a = float(px.a);

  vec3 pos = max(vec3(0.0), c - uKey) * uInvPos;
  vec3 neg = max(vec3(0.0), uKey - c) * uInvNeg;
  float aL = max(pos.r, max(pos.g, pos.b));
  float aD = max(neg.r, max(neg.g, neg.b));
  float cov = min(1.0, max(aL, aD) + min(aL, aD) * 0.5);
  float pChroma = uChromatic ? chromaProjection(c) : 0.0;
  if (uChromatic) {
    cov = max(cov, 1.0 - pChroma);
    if (aL > 0.12 && aD > 0.18 && pChroma < 0.25) cov = max(cov, min(1.0, 1.0 - pChroma * 0.35));
  } else if (uAnalysisDetail > 0.0) {
    cov = min(1.0, cov + neutralBoost(c, uAnalysisDetail, 1.0 / 12.0, 1.0 / 9.0, 0.0));
  }
  float dir = uShadowType == 1 ? (aL >= aD * 0.5 ? aL : 0.0) : uShadowType == 2 ? (aD > aL ? aD : 0.0) : cov;

  float dist = keyDistance(c);
  if (uChromatic) {
    if (pChroma > 0.08) dist = min(dist, max(0.0, (1.0 - pChroma * uTolFactor) * 200.0));
  } else if (uMatteDetail > 0.0) {
    dist += neutralBoost(c, uMatteDetail, 4.2, 2.8, 1.0);
  }
  float matte;
  if (dist <= uHard) matte = 0.0;
  else if (dist >= uHardEnd) matte = a;
  else {
    float t = clamp((dist - uHard) / uTw, 0.0, 1.0);
    matte = floor(a * (t * t * (3.0 - 2.0 * t)) + 0.5);
  }
  outColor = vec4(cov, dir, aL >= aD ? 1.0 : 0.0, matte);
}`

interface GpuState {
  gl: WebGL2RenderingContext
  program: WebGLProgram
  vao: WebGLVertexArrayObject
  srcTex: WebGLTexture
  outTex: WebGLTexture
  fbo: WebGLFramebuffer
  loc: Record<string, WebGLUniformLocation | null>
  maxTex: number
  outW: number
  outH: number
}

let enabled = true
/** `undefined` = chưa thử khởi tạo, `null` = máy / môi trường không hỗ trợ */
let gpu: GpuState | null | undefined
let lastError: string | null = null

/** Trạng thái đường GPU (chẩn đoán qua MCP / DevTools). */
export function getChromaGpuStatus(): { enabled: boolean; available: boolean; lastError: string | null } {
  return { enabled, available: isChromaGpuAvailable(), lastError }
}

/** Bật / tắt đường GPU (để đối chiếu hiệu năng hoặc khi nghi lỗi driver). */
export function setChromaGpuEnabled(value: boolean): void {
  enabled = value
}

export function isChromaGpuAvailable(): boolean {
  if (gpu === undefined) gpu = initGpu()
  return !!gpu
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)
  if (!sh) throw new Error('createShader failed')
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) || 'shader compile failed')
  return sh
}

const UNIFORMS = [
  'uSrc', 'uRowOffset', 'uKey', 'uInvPos', 'uInvNeg', 'uKc', 'uKcLenSq', 'uChromatic', 'uAnalysisDetail',
  'uShadowType', 'uMode', 'uKeyDominance', 'uKMean', 'uTolFactor', 'uMatteDetail', 'uHard', 'uTw', 'uHardEnd'
]

function initGpu(): GpuState | null {
  try {
    if (typeof OffscreenCanvas === 'undefined') return null
    const canvas = new OffscreenCanvas(1, 1)
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      powerPreference: 'high-performance'
    }) as WebGL2RenderingContext | null
    if (!gl || !gl.getExtension('EXT_color_buffer_float')) return null
    const program = gl.createProgram()
    const vao = gl.createVertexArray()
    const srcTex = gl.createTexture()
    const outTex = gl.createTexture()
    const fbo = gl.createFramebuffer()
    if (!program || !vao || !srcTex || !outTex || !fbo) return null
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT))
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'link failed')
    const loc: GpuState['loc'] = {}
    for (const name of UNIFORMS) loc[name] = gl.getUniformLocation(program, name)
    for (const tex of [srcTex, outTex]) {
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    }
    const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number
    return { gl, program, vao, srcTex, outTex, fbo, loc, maxTex, outW: 0, outH: 0 }
  } catch (err) {
    lastError = String(err instanceof Error ? err.message : err)
    console.warn('[chromaGpu] WebGL2 không khả dụng, dùng CPU:', err)
    return null
  }
}

function setUniforms(s: GpuState, settings: ChromaKeySettings, key: RgbColor): void {
  const { gl, loc } = s
  const A = buildChromaAnalysisParams(settings, key)
  const M = buildChromaMatteParams(settings, key)
  gl.uniform1i(loc.uSrc, 0)
  gl.uniform3f(loc.uKey, A.kr, A.kg, A.kb)
  gl.uniform3f(loc.uInvPos, A.invPosR, A.invPosG, A.invPosB)
  gl.uniform3f(loc.uInvNeg, A.invNegR, A.invNegG, A.invNegB)
  gl.uniform3f(loc.uKc, A.kcr, A.kcg, A.kcb)
  gl.uniform1f(loc.uKcLenSq, A.kcLenSq)
  gl.uniform1i(loc.uChromatic, A.isChromaticKey ? 1 : 0)
  gl.uniform1f(loc.uAnalysisDetail, A.detailProtection)
  gl.uniform1i(loc.uShadowType, A.shadowType)
  gl.uniform1i(loc.uMode, M.mode)
  gl.uniform1f(loc.uKeyDominance, M.keyDominance)
  gl.uniform1f(loc.uKMean, M.kMean)
  gl.uniform1f(loc.uTolFactor, M.tolFactor)
  gl.uniform1f(loc.uMatteDetail, M.detailProtection)
  gl.uniform1f(loc.uHard, M.hardThreshold)
  gl.uniform1f(loc.uTw, M.transitionWidth)
  gl.uniform1f(loc.uHardEnd, M.hardEnd)
}

function ensureOutputTarget(s: GpuState, w: number, h: number): void {
  const { gl } = s
  if (s.outW === w && s.outH === h) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, s.fbo)
    return
  }
  gl.bindTexture(gl.TEXTURE_2D, s.outTex)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, null)
  gl.bindFramebuffer(gl.FRAMEBUFFER, s.fbo)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, s.outTex, 0)
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('RGBA32F FBO incomplete')
  s.outW = w
  s.outH = h
  // Trả unit 0 về texture nguồn — nếu để texture output (đang gắn vào FBO) ở đó sẽ thành vòng lặp feedback
  gl.bindTexture(gl.TEXTURE_2D, s.srcTex)
}

/** Vẽ từng dải hàng vào FBO float rồi đọc về, tách ra các mảng kết quả. */
function runStrips(s: GpuState, w: number, h: number, out: { raw: Float32Array; dir: Float32Array; light: Uint8Array; matte: Uint8Array }): void {
  const { gl } = s
  const stripH = Math.max(1, Math.min(h, Math.floor(STRIP_PIXELS / w)))
  ensureOutputTarget(s, w, stripH)
  const buf = new Float32Array(w * stripH * 4)
  for (let y0 = 0; y0 < h; y0 += stripH) {
    const rows = Math.min(stripH, h - y0)
    gl.viewport(0, 0, w, rows)
    gl.uniform1i(s.loc.uRowOffset, y0)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    const view = rows === stripH ? buf : buf.subarray(0, w * rows * 4)
    gl.readPixels(0, 0, w, rows, gl.RGBA, gl.FLOAT, view)
    const base = y0 * w
    const n = w * rows
    for (let i = 0, j = 0; i < n; i++, j += 4) {
      const p = base + i
      out.raw[p] = view[j]
      out.dir[p] = view[j + 1]
      out.light[p] = view[j + 2] > 0.5 ? 1 : 0
      out.matte[p] = view[j + 3]
    }
  }
}

/**
 * Chạy giải pha màu + matte trên GPU. Trả về `null` (để chạy CPU) khi tắt GPU, ảnh nhỏ hơn
 * `CHROMA_GPU_MIN_PIXELS`, vượt `MAX_TEXTURE_SIZE`, môi trường không có WebGL2 hoặc GPU lỗi.
 */
export function runChromaGpuAnalysis(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  settings: ChromaKeySettings,
  key: RgbColor
): ChromaGpuResult | null {
  if (!enabled || w * h < CHROMA_GPU_MIN_PIXELS) return null
  if (gpu === undefined) gpu = initGpu()
  const s = gpu
  if (!s || w > s.maxTex || h > s.maxTex) return null
  const { gl } = s
  try {
    if (gl.isContextLost()) throw new Error('context lost')
    gl.useProgram(s.program)
    gl.bindVertexArray(s.vao)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, s.srcTex)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    // Texture số nguyên (RGBA8UI) chỉ nhận Uint8Array, không nhận Uint8ClampedArray
    const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8UI, w, h, 0, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, bytes)
    const uploadErr = gl.getError()
    if (uploadErr !== gl.NO_ERROR) throw new Error(`upload texture lỗi 0x${uploadErr.toString(16)}`)
    setUniforms(s, settings, key)
    const total = w * h
    const out = {
      raw: new Float32Array(total),
      dir: new Float32Array(total),
      light: new Uint8Array(total),
      matte: new Uint8Array(total)
    }
    runStrips(s, w, h, out)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    const glErr = gl.getError()
    if (glErr !== gl.NO_ERROR) throw new Error(`WebGL lỗi 0x${glErr.toString(16)}`)
    const analysis = finalizeChromaAnalysis(out.raw, out.dir, out.light, data, w, h, settings, key)
    return { analysis, matte: out.matte }
  } catch (err) {
    lastError = String(err instanceof Error ? err.message : err)
    console.warn('[chromaGpu] lỗi GPU, chuyển sang CPU:', err)
    gpu = null
    return null
  }
}
