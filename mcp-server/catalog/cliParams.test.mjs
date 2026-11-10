import { describe, expect, it } from 'vitest'
import { parseCliCallParams } from '../cliParams.mjs'

describe('CLI JSON escaping', () => {
  it('preserves quoted JavaScript, newlines and Windows paths in valid JSON', () => {
    const params = { code: 'const path = "D:\\\\tmp\\\\video.mp4";\nreturn { text: "hello", path }' }
    expect(parseCliCallParams([JSON.stringify(params)])).toEqual(params)
  })

  it('still accepts CMD escaped JSON after strict parsing fails', () => {
    expect(parseCliCallParams(['{\\"encoder\\":\\"cpu\\"}'])).toEqual({ encoder: 'cpu' })
  })
})
