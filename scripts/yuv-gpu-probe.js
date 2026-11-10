async function runYuvGpuProbe(api) {
const { YuvPacker } = await import('/src/engine/yuvPacker.ts')
const { AsyncFrameReadback } = await import('/src/engine/asyncReadback.ts')
const THREE = api.THREE
const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas') })
const results = []
try {
  for (const [width, height] of [[8, 4], [64, 36], [1920, 1080]]) {
    const packer = new YuvPacker(width, height)
    const readback = new AsyncFrameReadback(renderer.getContext(), packer.packedWidth, packer.packedHeight, 2)
    try {
      if (!packer.validate(renderer)) throw new Error('GPU validation failed')
      // Bốn phần màu, phân biệt trên/dưới và trái/phải; không dùng màu quy đổi sRGB.
      const colors = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 1]]
      renderer.setRenderTarget(packer.frameTarget)
      renderer.setScissorTest(true)
      for (let i = 0; i < 4; i++) {
        renderer.setScissor((i % 2) * width / 2, i < 2 ? height / 2 : 0, width / 2, height / 2)
        renderer.setClearColor(new THREE.Color().setRGB(...colors[i]), 1)
        renderer.clear()
      }
      packer.pack(renderer)
      readback.capture(17)
      const sync = new Uint8Array(packer.byteLength)
      renderer.readRenderTargetPixels(packer.packedTarget, 0, 0, packer.packedWidth, packer.packedHeight, sync)
      const asyncBytes = new Uint8Array(packer.byteLength)
      if (await readback.takeOldest(asyncBytes) !== 17) throw new Error('Wrong frame order')
      let maxError = 0
      for (let plane = 0; plane < 3; plane++) {
        const w = plane === 0 ? width : width / 2
        const h = plane === 0 ? height : height / 2
        const offset = plane === 0 ? 0 : width * height * (plane === 1 ? 1 : 1.25)
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const [r, g, b] = colors[(y < h / 2 ? 0 : 2) + (x < w / 2 ? 0 : 1)]
          const expected = Math.round(plane === 0 ? 16 + 65.481 * r + 128.553 * g + 24.966 * b
            : plane === 1 ? 128 - 37.797 * r - 74.203 * g + 112 * b : 128 + 112 * r - 93.786 * g - 18.214 * b)
          const at = offset + y * w + x
          maxError = Math.max(maxError, Math.abs(sync[at] - expected))
          if (sync[at] !== asyncBytes[at]) throw new Error('Async/sync mismatch')
        }
      }
      if (maxError > 1) throw new Error('YUV color/orientation error: ' + maxError)
      results.push({ width, height, maxError, bytes: sync.length })
    } finally { readback.dispose(); packer.dispose() }
  }
  const recovery = await checkYuvRecovery(renderer, YuvPacker, AsyncFrameReadback)
  return { passed: true, results, recovery }
} finally { renderer.dispose(); renderer.forceContextLoss() }
}

async function checkYuvRecovery(renderer, YuvPacker, AsyncFrameReadback) {
  const packer = new YuvPacker(8, 4)
  const old = new AsyncFrameReadback(renderer.getContext(), 2, 6)
  const ext = renderer.getContext().getExtension('WEBGL_lose_context')
  if (!ext) throw new Error('Missing WEBGL_lose_context for recovery test')
  const event = (name) => new Promise((resolve, reject) => {
    const handler = () => { clearTimeout(timer); resolve() }
    const timer = setTimeout(() => {
      renderer.domElement.removeEventListener(name, handler)
      reject(new Error('Timeout: ' + name))
    }, 10000)
    renderer.domElement.addEventListener(name, handler, { once: true })
  })
  try {
    if (!packer.validate(renderer)) throw new Error('Pre-loss validation failed')
    packer.pack(renderer)
    old.capture(1)
    const lost = event('webglcontextlost')
    ext.loseContext()
    await lost
    // Chromium chỉ cho restore sau khi task dispatch contextlost đã kết thúc.
    await new Promise((resolve) => setTimeout(resolve, 100))
    const restored = event('webglcontextrestored')
    ext.restoreContext()
    await restored
    if (!old.invalid || await old.takeOldest(new Uint8Array(48)) !== null) throw new Error('Stale PBO survived restore')
    if (!packer.validate(renderer)) throw new Error('Post-restore validation failed')
    const fresh = new AsyncFrameReadback(renderer.getContext(), 2, 6)
    try {
      packer.pack(renderer)
      fresh.capture(2)
      const out = new Uint8Array(48)
      if (await fresh.takeOldest(out, () => true) !== null) throw new Error('Cancellation ignored')
      if (await fresh.takeOldest(out) !== 2 || out[0] !== 16 || out[32] !== 128) throw new Error('Recovery frame corrupt')
    } finally { fresh.dispose() }
    return 'passed'
  } finally { old.dispose(); packer.dispose() }
}
