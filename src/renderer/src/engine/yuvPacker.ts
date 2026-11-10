import * as THREE from 'three'

/**
 * Chuyển frame RGBA đã render sang YUV420p (BT.601, dải TV — giống mặc định swscale của ffmpeg) ngay trên
 * GPU rồi đóng gói 4 byte vào 1 texel RGBA8. Kết quả đọc về là đúng bố cục planar Y → U → V từ trên xuống
 * của ffmpeg `-pix_fmt yuv420p`: dữ liệu mỗi frame giảm từ 4 xuống 1,5 byte/pixel (2,67 lần) cho cả bước
 * đọc pixel, IPC lẫn ffmpeg, và không cần `-vf vflip` nữa.
 *
 * Target đóng gói rộng W/4 texel, cao 1,5·H hàng: H hàng Y, H/4 hàng U (mỗi hàng chứa 2 hàng U rộng W/2),
 * H/4 hàng V. Yêu cầu W chia hết cho 8 và H chia hết cho 4 (`supportsYuvPacking`).
 */
const YUV_VERT = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const YUV_FRAG = /* glsl */ `
precision highp float;
precision highp int;
uniform sampler2D tSrc;
uniform int uW;
uniform int uH;
out vec4 outColor;

vec3 rgbAt(int x, int yTop) {
  return texelFetch(tSrc, ivec2(x, uH - 1 - yTop), 0).rgb;
}

float lumaAt(int x, int yTop) {
  vec3 c = rgbAt(x, yTop);
  return 16.0 + 65.481 * c.r + 128.553 * c.g + 24.966 * c.b;
}

vec3 avg2x2(int cx, int cy) {
  int x = cx * 2;
  int y = cy * 2;
  return (rgbAt(x, y) + rgbAt(x + 1, y) + rgbAt(x, y + 1) + rgbAt(x + 1, y + 1)) * 0.25;
}

void main() {
  int ox = int(gl_FragCoord.x);
  int k = int(gl_FragCoord.y);
  vec4 o;
  if (k < uH) {
    int x0 = ox * 4;
    o = vec4(lumaAt(x0, k), lumaAt(x0 + 1, k), lumaAt(x0 + 2, k), lumaAt(x0 + 3, k));
  } else {
    int quarter = uH / 4;
    int local = k - uH;
    bool isV = local >= quarter;
    if (isV) local -= quarter;
    int texelsPerChromaRow = uW / 8;
    int crow = local * 2 + (ox >= texelsPerChromaRow ? 1 : 0);
    int cx0 = (ox - (ox >= texelsPerChromaRow ? texelsPerChromaRow : 0)) * 4;
    for (int j = 0; j < 4; j++) {
      vec3 c = avg2x2(cx0 + j, crow);
      o[j] = isV
        ? 128.0 + 112.0 * c.r - 93.786 * c.g - 18.214 * c.b
        : 128.0 - 37.797 * c.r - 74.203 * c.g + 112.0 * c.b;
    }
  }
  outColor = clamp(floor(o + 0.5), 0.0, 255.0) / 255.0;
}
`

export function supportsYuvPacking(width: number, height: number): boolean {
  return width >= 8 && height >= 4 && width % 8 === 0 && height % 4 === 0
}

export class YuvPacker {
  /** Frame RGBA cuối cùng (sau post) được render vào đây thay cho canvas. */
  readonly frameTarget: THREE.WebGLRenderTarget
  readonly packedTarget: THREE.WebGLRenderTarget
  readonly packedWidth: number
  readonly packedHeight: number
  private readonly material: THREE.ShaderMaterial
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private readonly quad: THREE.Mesh

  constructor(readonly width: number, readonly height: number) {
    if (!supportsYuvPacking(width, height)) throw new Error(`YuvPacker: ${width}x${height} không chia hết cho 8×4`)
    const rtOpts = { depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false }
    this.frameTarget = new THREE.WebGLRenderTarget(width, height, rtOpts)
    this.packedWidth = width / 4
    this.packedHeight = (height * 3) / 2
    this.packedTarget = new THREE.WebGLRenderTarget(this.packedWidth, this.packedHeight, rtOpts)
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: YUV_VERT,
      fragmentShader: YUV_FRAG,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
      toneMapped: false,
      uniforms: {
        tSrc: { value: this.frameTarget.texture },
        uW: { value: width },
        uH: { value: height }
      }
    })
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material)
    this.quad.frustumCulled = false
    this.scene.add(this.quad)
  }

  /** Byte mỗi frame YUV420p. */
  get byteLength(): number {
    return (this.width * this.height * 3) / 2
  }

  /** Đóng gói `frameTarget` vào `packedTarget`; target này vẫn được bind để đọc pixel ngay sau đó. */
  pack(renderer: THREE.WebGLRenderer): void {
    renderer.setRenderTarget(this.packedTarget)
    renderer.setScissorTest(false)
    renderer.setViewport(0, 0, this.packedWidth, this.packedHeight)
    renderer.render(this.scene, this.camera)
  }

  /** Kiểm tra shader/FBO trên GPU thật trước khi cam kết định dạng với encoder. */
  validate(renderer: THREE.WebGLRenderer): boolean {
    const previous = renderer.getRenderTarget()
    const color = renderer.getClearColor(new THREE.Color())
    const alpha = renderer.getClearAlpha()
    const viewport = renderer.getViewport(new THREE.Vector4())
    const scissor = renderer.getScissorTest()
    const sample = new Uint8Array(4)
    try {
      if (Math.max(this.width, this.height, this.packedHeight) > renderer.capabilities.maxTextureSize) return false
      renderer.setRenderTarget(this.frameTarget)
      renderer.setScissorTest(false)
      renderer.setClearColor(0, 1)
      renderer.clear()
      this.pack(renderer)
      for (const [row, value] of [[0, 16], [this.height, 128], [this.height * 5 / 4, 128]]) {
        renderer.readRenderTargetPixels(this.packedTarget, 0, row, 1, 1, sample)
        if (!sample.every((v) => v === value)) return false
      }
      return !renderer.getContext().isContextLost()
    } catch {
      return false
    } finally {
      renderer.setRenderTarget(previous)
      renderer.setClearColor(color, alpha)
      renderer.setViewport(viewport)
      renderer.setScissorTest(scissor)
    }
  }

  dispose(): void {
    this.frameTarget.dispose()
    this.packedTarget.dispose()
    this.material.dispose()
    this.quad.geometry.dispose()
  }
}
