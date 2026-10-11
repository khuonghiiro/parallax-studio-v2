import { describe, it, expect } from 'vitest'
import { formatAudioDuration } from './MusicPanel'

describe('MusicPanel formatAudioDuration', () => {
  it('định dạng thời lượng âm thanh 0s hoặc không hợp lệ', () => {
    expect(formatAudioDuration(0)).toBe('0:00')
    expect(formatAudioDuration(-5)).toBe('0:00')
    expect(formatAudioDuration(NaN)).toBe('0:00')
  })

  it('định dạng giây dưới 10 giây có số 0 đằng trước', () => {
    expect(formatAudioDuration(5)).toBe('0:05')
    expect(formatAudioDuration(9)).toBe('0:09')
  })

  it('định dạng giây từ 10s đến 59s', () => {
    expect(formatAudioDuration(45)).toBe('0:45')
    expect(formatAudioDuration(59)).toBe('0:59')
  })

  it('định dạng phút và giây chính xác', () => {
    expect(formatAudioDuration(60)).toBe('1:00')
    expect(formatAudioDuration(75)).toBe('1:15')
    expect(formatAudioDuration(125)).toBe('2:05')
    expect(formatAudioDuration(3600)).toBe('60:00')
  })
})
