import { describe, it, expect } from 'vitest'
import { formatAudioDuration, detectAudioCategory } from './MusicPanel'


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

describe('detectAudioCategory', () => {
  it('nhận diện đúng thể loại voice (lời thoại/lồng tiếng)', () => {
    expect(detectAudioCategory('voice_radio_intro.wav')).toBe('voice')
    expect(detectAudioCategory('hoi_thoai_nhan_vat.mp3')).toBe('voice')
    expect(detectAudioCategory('podcast_ep1.aac')).toBe('voice')
    expect(detectAudioCategory('thuyet_minh_phim.ogg')).toBe('voice')
  })

  it('nhận diện đúng thể loại sfx (hiệu ứng/tiếng động như súng, cành cây)', () => {
    expect(detectAudioCategory('sfx_gunshot.wav')).toBe('sfx')
    expect(detectAudioCategory('sfx_branch_snap.wav')).toBe('sfx')
    expect(detectAudioCategory('laser_shot_fx.mp3')).toBe('sfx')
    expect(detectAudioCategory('tieng_canh_cay_gay.wav')).toBe('sfx')
    expect(detectAudioCategory('tieng_sung_luc.wav')).toBe('sfx')
    expect(detectAudioCategory('footstep_dirt.wav')).toBe('sfx')
    expect(detectAudioCategory('explosion_boom.wav')).toBe('sfx')
  })

  it('nhận diện đúng thể loại cinematic (chuyển cảnh/whoosh)', () => {
    expect(detectAudioCategory('cinematic_whoosh.wav')).toBe('cinematic')
    expect(detectAudioCategory('camera_transition_riser.mp3')).toBe('cinematic')
    expect(detectAudioCategory('whoosh_fast.wav')).toBe('cinematic')
  })

  it('nhận diện đúng thể loại ambient (âm đệm tĩnh/gió/chuông gió)', () => {
    expect(detectAudioCategory('ambient_night_wind.wav')).toBe('ambient')
    expect(detectAudioCategory('tieng_gio_dem.mp3')).toBe('ambient')
    expect(detectAudioCategory('tieng_mua_roi.wav')).toBe('ambient')
    expect(detectAudioCategory('wind_chimes.wav')).toBe('ambient')
  })

  it('nhận diện mặc định là music cho giai điệu và bgm', () => {
    expect(detectAudioCategory('music_chill_melody.wav')).toBe('music')
    expect(detectAudioCategory('bgm_cyberpunk.mp3')).toBe('music')
    expect(detectAudioCategory('piano_theme.wav')).toBe('music')
    expect(detectAudioCategory('track_01.mp3')).toBe('music')
  })

  it('ưu tiên category chỉ định trước tên tệp nếu có trường category trong AssetMeta', () => {
    // Tệp tên sfx nhưng người dùng phân loại vào voice
    const metaWithCat = { name: 'sfx_sound.wav', category: 'voice' }
    const cat = metaWithCat.category || detectAudioCategory(metaWithCat.name)
    expect(cat).toBe('voice')

    // Tệp không có category thì tự động nhận diện
    const metaWithoutCat = { name: 'sfx_gunshot.wav', category: undefined }
    const fallbackCat = metaWithoutCat.category || detectAudioCategory(metaWithoutCat.name)
    expect(fallbackCat).toBe('sfx')
  })
})


