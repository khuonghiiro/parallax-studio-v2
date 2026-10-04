import ffmpegPath from 'ffmpeg-static'
import { spawnSync } from 'child_process'
import { readFileSync, statSync, writeFileSync } from 'fs'
import { join } from 'path'

const artifactDir = 'C:\\Users\\Admin\\.gemini\\antigravity-ide\\brain\\1ebafd9b-faf4-4bd4-8220-ea842b0cc69f'
const outDir = 'src/renderer/public/effects'

const items = [
  {
    name: 'realistic_mist',
    src: join(artifactDir, 'cinematic_fog_mist_1791122961437.jpg'),
    dest: join(outDir, 'realistic_mist.webp'),
    // Pure luminous white fog droplets with soft feathered edges on all 4 borders
    vf: "scale=1600:900,format=rgba,geq=r='245':g='250':b='255':a='min(255,max(r(X,Y),max(g(X,Y),b(X,Y)))*1.3)*min(1,min(X/200,(W-X)/200))*min(1,min(Y/120,(H-Y)/120))'",
    q: '80'
  },
  {
    name: 'realistic_rain',
    src: join(artifactDir, 'cinematic_rain_sheet_1791122985683.jpg'),
    dest: join(outDir, 'realistic_rain.webp'),
    // Crisp white raindrops with feathering at borders
    vf: "scale=1600:900,format=rgba,geq=r='255':g='255':b='255':a='min(255,max(r(X,Y),max(g(X,Y),b(X,Y)))*1.4)*min(1,min(X/160,(W-X)/160))*min(1,min(Y/100,(H-Y)/100))'",
    q: '80'
  },
  {
    name: 'realistic_twilight_mist',
    src: join(artifactDir, 'cinematic_twilight_mist_1791123042773.jpg'),
    dest: join(outDir, 'realistic_twilight_mist.webp'),
    // Warm golden amber twilight haze with feathered edges
    vf: "scale=1600:900,format=rgba,geq=r='255':g='215':b='170':a='min(255,max(r(X,Y),max(g(X,Y),b(X,Y)))*1.3)*min(1,min(X/200,(W-X)/200))*min(1,min(Y/120,(H-Y)/120))'",
    q: '80'
  }
]

const base64Map = {}

for (const item of items) {
  const res = spawnSync(ffmpegPath, [
    '-y',
    '-i', item.src,
    '-vf', item.vf,
    '-c:v', 'libwebp',
    '-quality', item.q,
    item.dest
  ])
  if (res.status !== 0) {
    console.error(`Failed ${item.name}:`, res.stderr.toString())
    process.exit(1)
  }
  const bytes = readFileSync(item.dest)
  console.log(`${item.name}: ${bytes.length} bytes`)
  base64Map[item.name] = `data:image/webp;base64,${bytes.toString('base64')}`
}

const tsContent = `/**
 * Pre-baked photorealistic cinematic effect textures (WebP with alpha).
 * Real volumetric fog, smoke tendrils, rain streaks - 100% image layers.
 */
export const EFFECT_ASSETS = {
  mist: ${JSON.stringify(base64Map.realistic_mist)},
  rain: ${JSON.stringify(base64Map.realistic_rain)},
  twilightMist: ${JSON.stringify(base64Map.realistic_twilight_mist)}
} as const
`
writeFileSync('src/renderer/src/project/effectAssets.ts', tsContent)
console.log('Successfully wrote src/renderer/src/project/effectAssets.ts!')
