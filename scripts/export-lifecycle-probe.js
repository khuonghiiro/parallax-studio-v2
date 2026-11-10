async function runExportLifecycleProbe(api, outputDir) {
  const { runExport } = await import('/src/export/runExport.ts')
  const preview = document.createElement('canvas')
  preview.width = 128
  preview.height = 72
  let stop = false
  const base = { encoder: 'cpu', withAudio: false, height: 72, fps: 30, pixelFormat: 'yuv420p' }
  const cancelled = await runExport(api.project, { ...base, end: 1, outPath: outputDir + '/cancelled.mp4' },
    (p) => { if (p.frame >= 2) stop = true }, () => stop, preview)
  if (!cancelled.cancelled) throw new Error('Export did not cancel')
  if (preview.getContext('2d').getImageData(0, 0, 1, 1).data[3] !== 255) throw new Error('Missing YUV preview')
  const sync = await runExport(api.project, { ...base, end: 0.1, readback: 'sync', outPath: outputDir + '/sync.mp4' })
  if (!sync.ok || sync.pixelFormat !== 'yuv420p' || sync.frames !== 3) throw new Error('Export after cancellation failed: ' + JSON.stringify(sync))
  const fallback = await runExport(api.project, { ...base, height: 74, end: 0.1, outPath: outputDir + '/fallback.mp4' })
  if (!fallback.ok || fallback.pixelFormat !== 'rgba') throw new Error('Unsupported size did not fall back: ' + JSON.stringify(fallback))
  return { passed: true, cancelled, sync, fallback }
}
