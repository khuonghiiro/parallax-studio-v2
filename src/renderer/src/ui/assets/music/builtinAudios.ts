import type { BuiltInAssetItem } from '@shared/ipc'
import type { AssetMeta } from '@shared/types'
import type { AudioCategoryType } from './MusicCategoryBar'
import type { AudioEntry } from './MusicItemCard'

/**
 * 7 tệp âm thanh mẫu có sẵn phong phú nhiều thể loại trong Parallax Studio V2
 */
export const DEFAULT_BUILTIN_AUDIOS: AudioEntry[] = [
  {
    id: 'builtin-ambient-chime',
    name: 'Chuông gió ngân vang (Ambient Chime)',
    source: 'builtin',
    category: 'ambient',
    relPath: 'audio/ambient_chime.wav',
    format: 'WAV'
  },
  {
    id: 'builtin-ambient-night-wind',
    name: 'Gió đêm huyền ảo (Night Wind)',
    source: 'builtin',
    category: 'ambient',
    relPath: 'audio/ambient_night_wind.wav',
    format: 'WAV'
  },
  {
    id: 'builtin-music-chill-melody',
    name: 'Giai điệu thư giãn (Chill Melody)',
    source: 'builtin',
    category: 'music',
    relPath: 'audio/music_chill_melody.wav',
    format: 'WAV'
  },
  {
    id: 'builtin-sfx-gunshot',
    name: 'Phát súng không gian (Laser Shot)',
    source: 'builtin',
    category: 'sfx',
    relPath: 'audio/sfx_gunshot.wav',
    format: 'WAV'
  },
  {
    id: 'builtin-sfx-branch-snap',
    name: 'Cành cây gãy giòn (Branch Snap)',
    source: 'builtin',
    category: 'sfx',
    relPath: 'audio/sfx_branch_snap.wav',
    format: 'WAV'
  },
  {
    id: 'builtin-cinematic-whoosh',
    name: 'Chuyển cảnh vút gió (Camera Whoosh)',
    source: 'builtin',
    category: 'cinematic',
    relPath: 'audio/cinematic_whoosh.wav',
    format: 'WAV'
  },
  {
    id: 'builtin-voice-radio-intro',
    name: 'Tín hiệu lời thoại vô tuyến (Radio Voice)',
    source: 'builtin',
    category: 'voice',
    relPath: 'audio/voice_radio_intro.wav',
    format: 'WAV'
  }
]

/** Loại bỏ dấu tiếng Việt để đối chiếu tên tệp không dấu (ví dụ: tieng_sung, hoi_thoai) */
export function removeVietnameseDiacritics(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
}

/**
 * Tự động nhận diện thể loại âm thanh dựa trên từ khóa tên tệp (hỗ trợ cả tiếng Anh, tiếng Việt có dấu và không dấu)
 */
export function detectAudioCategory(name: string): AudioCategoryType {
  const raw = (name || '').toLowerCase()
  const norm = removeVietnameseDiacritics(raw)
  // Thay thế ký tự phân cách gạch dưới, gạch ngang, dấu chấm bằng dấu cách
  const clean = norm.replace(/[^a-z0-9]/g, ' ')
  const words = new Set(clean.split(/\s+/).filter(Boolean))

  const hasPhrase = (phrase: string) => {
    const cleanPhrase = removeVietnameseDiacritics(phrase).replace(/[^a-z0-9]/g, ' ')
    return clean.includes(cleanPhrase) || raw.includes(phrase.toLowerCase())
  }
  const hasWord = (word: string) => words.has(word.toLowerCase())

  // 1. Thể loại Lời thoại & Lồng tiếng (Voice)
  if (
    hasPhrase('voice') ||
    hasPhrase('thoại') ||
    hasPhrase('thoai') ||
    hasPhrase('speech') ||
    hasPhrase('podcast') ||
    hasPhrase('dialog') ||
    hasPhrase('narration') ||
    hasPhrase('thuyết minh') ||
    hasPhrase('thuyet minh') ||
    hasPhrase('lồng tiếng') ||
    hasPhrase('long tieng') ||
    hasPhrase('radio') ||
    hasPhrase('vocal') ||
    hasPhrase('diễn đọc') ||
    hasPhrase('dien doc') ||
    hasWord('noi') ||
    hasWord('talk')
  ) {
    return 'voice'
  }

  // 2. Thể loại Hiệu ứng & Tiếng động (SFX)
  if (
    hasPhrase('shot') ||
    hasPhrase('gun') ||
    hasPhrase('súng') ||
    hasPhrase('sung') ||
    hasPhrase('bắn') ||
    hasPhrase('snap') ||
    hasPhrase('cành cây') ||
    hasPhrase('canh cay') ||
    hasPhrase('gãy') ||
    hasPhrase('break') ||
    hasPhrase('va chạm') ||
    hasPhrase('va cham') ||
    hasPhrase('footstep') ||
    hasPhrase('bước chân') ||
    hasPhrase('buoc chan') ||
    hasPhrase('sword') ||
    hasPhrase('kiếm') ||
    hasPhrase('kiem') ||
    hasPhrase('punch') ||
    hasPhrase('door') ||
    hasPhrase('cửa') ||
    hasPhrase('cua') ||
    hasPhrase('sfx') ||
    hasPhrase('explosion') ||
    hasPhrase('tiếng nổ') ||
    hasPhrase('tieng no') ||
    hasPhrase('laser') ||
    hasWord('hit') ||
    hasWord('no') ||
    hasWord('gay')
  ) {
    return 'sfx'
  }

  // 3. Thể loại Chuyển cảnh & Kịch tính (Cinematic)
  if (
    hasPhrase('whoosh') ||
    hasPhrase('swoosh') ||
    hasPhrase('riser') ||
    hasPhrase('impact') ||
    hasPhrase('boom') ||
    hasPhrase('cinematic') ||
    hasPhrase('kịch tính') ||
    hasPhrase('kich tinh') ||
    hasPhrase('transition') ||
    hasPhrase('chuyển cảnh') ||
    hasPhrase('chuyen canh') ||
    hasPhrase('stinger') ||
    hasPhrase('trailer') ||
    hasPhrase('hit marker')
  ) {
    return 'cinematic'
  }

  // 4. Thể loại Âm đệm & Môi trường (Ambient)
  if (
    hasPhrase('wind') ||
    hasPhrase('gió') ||
    hasPhrase('gio') ||
    hasPhrase('rain') ||
    hasPhrase('mưa') ||
    hasPhrase('mua') ||
    hasPhrase('chime') ||
    hasPhrase('chuông') ||
    hasPhrase('chuong') ||
    hasPhrase('ambient') ||
    hasPhrase('âm đệm') ||
    hasPhrase('am dem') ||
    hasPhrase('môi trường') ||
    hasPhrase('moi truong') ||
    hasPhrase('nature') ||
    hasPhrase('thiên nhiên') ||
    hasPhrase('thien nhien') ||
    hasPhrase('đêm tĩnh') ||
    hasPhrase('dem tinh') ||
    hasPhrase('forest') ||
    hasPhrase('rừng') ||
    hasPhrase('rung') ||
    hasPhrase('sea') ||
    hasPhrase('biển') ||
    hasPhrase('bien') ||
    hasPhrase('water') ||
    hasPhrase('sóng biển') ||
    hasPhrase('song bien') ||
    hasPhrase('chim') ||
    hasPhrase('bird')
  ) {
    return 'ambient'
  }

  // Mặc định là Nhạc nền & Giai điệu (Music)
  return 'music'
}

/**
 * Lấy danh sách đầy đủ các tệp âm thanh trong kho mẫu built-in,
 * kết hợp 7 mẫu mặc định và các tệp âm thanh phát hiện từ thư mục assets/audio/ trong catalog
 */
export function getBuiltInAudios(catalogItems?: BuiltInAssetItem[]): AudioEntry[] {
  const result: AudioEntry[] = [...DEFAULT_BUILTIN_AUDIOS]
  const knownRelPaths = new Set(result.map((r) => r.relPath?.toLowerCase()))

  if (catalogItems && Array.isArray(catalogItems)) {
    for (const item of catalogItems) {
      if (item.kind !== 'audio' && item.folder !== 'audio') continue
      const relNorm = item.relativePath.replace(/\\/g, '/').toLowerCase()
      if (knownRelPaths.has(relNorm)) continue

      knownRelPaths.add(relNorm)
      const ext = item.ext?.toUpperCase() || item.fileName.split('.').pop()?.toUpperCase() || 'AUDIO'
      result.push({
        id: `builtin-${item.id}`,
        name: item.name || item.fileName,
        source: 'builtin',
        category: detectAudioCategory(item.name || item.fileName),
        relPath: item.relativePath.replace(/\\/g, '/'),
        format: ext
      })
    }
  }

  return result
}

/**
 * Tính tổng số lượng tệp âm thanh đang có trong tab Nhạc
 * bao gồm tệp trong dự án và các tệp trong kho mẫu
 */
export function getAudioCount(projectAssets: AssetMeta[] = [], catalogItems?: BuiltInAssetItem[]): number {
  const projectAudioCount = projectAssets.filter((a) => a.kind === 'audio').length
  const builtinAudios = getBuiltInAudios(catalogItems)
  return projectAudioCount + builtinAudios.length
}
