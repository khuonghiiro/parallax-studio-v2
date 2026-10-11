import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const assetsAudioDir = path.resolve(__dirname, '../assets/audio')

if (!fs.existsSync(assetsAudioDir)) {
  fs.mkdirSync(assetsAudioDir, { recursive: true })
}

/**
 * Tạo buffer file WAV PCM 16-bit mono 44100Hz
 */
function createWavBuffer(samples, sampleRate = 44100) {
  const numChannels = 1
  const bitsPerSample = 16
  const bytesPerSample = bitsPerSample / 8
  const blockAlign = numChannels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = samples.length * bytesPerSample
  const buffer = Buffer.alloc(44 + dataSize)

  // RIFF Chunk
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)

  // fmt Subchunk
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16) // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20) // AudioFormat (1 for PCM)
  buffer.writeUInt16LE(numChannels, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(byteRate, 28)
  buffer.writeUInt16LE(blockAlign, 32)
  buffer.writeUInt16LE(bitsPerSample, 34)

  // data Subchunk
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)

  // Ghi sample data (Float -1.0 .. 1.0 -> Int16)
  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    const val = s < 0 ? s * 0x8000 : s * 0x7fff
    buffer.writeInt16LE(Math.round(val), offset)
    offset += 2
  }

  return buffer
}

const sampleRate = 44100

// 1. SFX Phát súng Laser (Laser Gunshot) ~0.4s
function generateGunshot() {
  const dur = 0.45
  const total = Math.floor(dur * sampleRate)
  const samples = new Float32Array(total)
  for (let i = 0; i < total; i++) {
    const t = i / sampleRate
    const env = Math.exp(-t * 9)
    // Tần số trượt từ 1800Hz xuống 120Hz
    const freq = 1800 * Math.exp(-t * 12) + 120
    const phase = 2 * Math.PI * freq * t
    const tone = Math.sin(phase) + 0.3 * Math.sin(phase * 2)
    const noise = (Math.random() * 2 - 1) * Math.exp(-t * 20) * 0.4
    samples[i] = (tone * 0.7 + noise) * env
  }
  return samples
}

// 2. SFX Cành cây gãy (Branch Snap) ~0.35s
function generateBranchSnap() {
  const dur = 0.38
  const total = Math.floor(dur * sampleRate)
  const samples = new Float32Array(total)
  for (let i = 0; i < total; i++) {
    const t = i / sampleRate
    // Xung nứt gãy kép
    const env1 = Math.exp(-t * 35)
    const t2 = Math.max(0, t - 0.04)
    const env2 = Math.exp(-t2 * 25) * 0.8
    const snapNoise = (Math.random() * 2 - 1) * (env1 + env2)
    // Âm sắc thân gỗ đặc (320Hz + 850Hz)
    const woodBody = Math.sin(2 * Math.PI * 340 * t) * Math.exp(-t * 15) * 0.6
    samples[i] = (snapNoise * 0.75 + woodBody * 0.25)
  }
  return samples
}

// 3. Cinematic Whoosh lướt camera chuyển cảnh ~1.2s
function generateWhoosh() {
  const dur = 1.2
  const total = Math.floor(dur * sampleRate)
  const samples = new Float32Array(total)
  for (let i = 0; i < total; i++) {
    const t = i / sampleRate
    // Đỉnh điểm ở giữa (0.6s)
    const center = 0.55
    const dist = Math.abs(t - center)
    const env = Math.exp(-Math.pow(dist / 0.22, 2))
    // Tiếng rít gió tần số cao tăng dần rồi lặn xuống
    const f = 200 + 1200 * Math.sin((t / dur) * Math.PI)
    const noise = (Math.random() * 2 - 1)
    const tone = Math.sin(2 * Math.PI * f * t) * 0.35
    samples[i] = (noise * 0.65 + tone) * env * 0.95
  }
  return samples
}

// 4. Ambient Gió đêm huyền ảo (Night Wind) ~3.2s
function generateNightWind() {
  const dur = 3.2
  const total = Math.floor(dur * sampleRate)
  const samples = new Float32Array(total)
  let prev = 0
  for (let i = 0; i < total; i++) {
    const t = i / sampleRate
    const swell = 0.6 + 0.4 * Math.sin(2 * Math.PI * 0.4 * t)
    const rawNoise = Math.random() * 2 - 1
    // Bộ lọc thông thấp mềm (Lowpass)
    const alpha = 0.08 + 0.05 * Math.sin(2 * Math.PI * 0.3 * t)
    prev = prev + alpha * (rawNoise - prev)
    // Âm ù đệm không gian 90Hz
    const drone = Math.sin(2 * Math.PI * 90 * t) * 0.15
    samples[i] = (prev * 0.85 + drone) * swell * 0.8
  }
  return samples
}

// 5. Music Giai điệu thư giãn (Chill Melody) ~3.5s
function generateChillMelody() {
  const dur = 3.6
  const total = Math.floor(dur * sampleRate)
  const samples = new Float32Array(total)
  // Các nốt nhạc: C4(261.6), E4(329.6), G4(392.0), B4(493.9), C5(523.3)
  const notes = [
    { freq: 261.63, start: 0.0, len: 1.2 },
    { freq: 329.63, start: 0.6, len: 1.2 },
    { freq: 392.00, start: 1.2, len: 1.2 },
    { freq: 493.88, start: 1.8, len: 1.2 },
    { freq: 523.25, start: 2.4, len: 1.1 }
  ]
  for (let i = 0; i < total; i++) {
    const t = i / sampleRate
    let acc = 0
    for (const n of notes) {
      if (t >= n.start && t < n.start + n.len) {
        const dt = t - n.start
        const noteEnv = Math.exp(-dt * 2.5) * (1 - Math.exp(-dt * 50))
        const p = 2 * Math.PI * n.freq * dt
        // Bell-like harmonic timbre
        const wave = Math.sin(p) + 0.35 * Math.sin(p * 2) + 0.15 * Math.sin(p * 3)
        acc += wave * noteEnv * 0.28
      }
    }
    samples[i] = acc
  }
  return samples
}

// 6. Voice Tín hiệu lời thoại vô tuyến (Radio Dialogue) ~1.8s
function generateRadioVoice() {
  const dur = 1.8
  const total = Math.floor(dur * sampleRate)
  const samples = new Float32Array(total)
  for (let i = 0; i < total; i++) {
    const t = i / sampleRate
    const env = t < 0.1 ? t / 0.1 : t > 1.6 ? (1.8 - t) / 0.2 : 1.0
    // Âm thoại mô phỏng formant giọng nói (f1=500Hz, f2=1500Hz, f3=2500Hz)
    const pitch = 130 + 15 * Math.sin(2 * Math.PI * 2.5 * t)
    const glottal = Math.sin(2 * Math.PI * pitch * t)
    const formant = Math.sin(2 * Math.PI * 650 * t) * 0.4 + Math.sin(2 * Math.PI * 1600 * t) * 0.3
    const staticNoise = (Math.random() * 2 - 1) * 0.08
    samples[i] = (glottal * formant + staticNoise) * env * 0.55
  }
  return samples
}

const audioFiles = [
  { name: 'sfx_gunshot.wav', fn: generateGunshot, title: 'Phát súng không gian (Laser Shot)' },
  { name: 'sfx_branch_snap.wav', fn: generateBranchSnap, title: 'Cành cây gãy giòn (Branch Snap)' },
  { name: 'cinematic_whoosh.wav', fn: generateWhoosh, title: 'Chuyển cảnh vút gió (Camera Whoosh)' },
  { name: 'ambient_night_wind.wav', fn: generateNightWind, title: 'Gió đêm huyền ảo (Night Wind Ambience)' },
  { name: 'music_chill_melody.wav', fn: generateChillMelody, title: 'Giai điệu thư giãn (Chill Melody)' },
  { name: 'voice_radio_intro.wav', fn: generateRadioVoice, title: 'Tín hiệu lời thoại vô tuyến (Radio Voice)' }
]

console.log('Generating built-in studio audio assets...')

for (const item of audioFiles) {
  const samples = item.fn()
  const buf = createWavBuffer(samples, sampleRate)
  const dest = path.join(assetsAudioDir, item.name)
  fs.writeFileSync(dest, buf)
  console.log(`✓ Created: ${item.name} (${(buf.length / 1024).toFixed(1)} KB) - ${item.title}`)
}

console.log('All audio assets generated successfully!')
