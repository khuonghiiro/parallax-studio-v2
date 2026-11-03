import { useState, type ReactNode } from 'react'
import {
  IconAnimalPaw,
  IconArmchair,
  IconBrokenIconFallback,
  IconCarVehicle,
  IconCinematicClapper,
  IconCity,
  IconCube,
  IconDecor,
  IconFilm,
  IconFlame,
  IconFolder,
  IconGrid,
  IconGrid3D,
  IconHome,
  IconImage,
  IconLayersStack,
  IconLightning,
  IconMusic,
  IconPropLamp,
  IconSparkles,
  IconTree,
  IconUser,
  IconUserBack,
  IconUserFemale,
  IconUserMale,
  IconUserQuarter,
  IconVoiceMic
} from '../icons'
import { useAssetManifestStore } from '../../store/assetManifest'

export interface CategoryIconMeta {
  iconUrl?: string
  iconText?: string
}

function resolveManifestIconUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim()
  if (!trimmed) return null
  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed
  }
  const norm = trimmed.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^assets\//, '')
  const map = useAssetManifestStore.getState().iconUrls || {}
  return map[norm] || map[`assets/${norm}`] || map[trimmed] || null
}

function CategoryImageIcon({
  rawUrl,
  resolvedSrc,
  width,
  height
}: {
  rawUrl: string
  resolvedSrc: string | null
  width: number
  height: number
}): ReactNode {
  const [failed, setFailed] = useState(false)

  if (!resolvedSrc || failed) {
    return (
      <span
        className="cat-icon-broken-fallback"
        data-icon-fallback="broken"
        title={`Link icon "${rawUrl}" không tìm thấy (kiểm tra thư mục assets/icons/) — Đang hiển thị icon mặc định cảnh báo`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--key, #f59e0b)'
        }}
      >
        <IconBrokenIconFallback width={width} height={height} />
      </span>
    )
  }

  return (
    <img
      src={resolvedSrc}
      alt=""
      width={width}
      height={height}
      onError={() => setFailed(true)}
      style={{
        width,
        height,
        objectFit: 'contain',
        display: 'inline-block',
        verticalAlign: 'middle'
      }}
    />
  )
}

export function renderCategoryIcon(
  iconKey: string,
  width = 16,
  height = 16,
  categoryId?: string,
  meta?: CategoryIconMeta
): ReactNode {
  if (meta?.iconUrl && meta.iconUrl.trim()) {
    const resolved = resolveManifestIconUrl(meta.iconUrl)
    return <CategoryImageIcon rawUrl={meta.iconUrl} resolvedSrc={resolved} width={width} height={height} />
  }

  // Hỗ trợ nếu người dùng điền thẳng đường dẫn ảnh/icon vào trường icon (ví dụ "icons/fire.svg" hoặc "https://...")
  if (
    iconKey &&
    (iconKey.includes('/') ||
      iconKey.endsWith('.svg') ||
      iconKey.endsWith('.png') ||
      iconKey.startsWith('data:'))
  ) {
    const resolved = resolveManifestIconUrl(iconKey)
    return <CategoryImageIcon rawUrl={iconKey} resolvedSrc={resolved} width={width} height={height} />
  }

  let key = (iconKey || '').trim().toLowerCase()

  if ((key === 'text' || !key) && meta?.iconText?.trim()) {
    return (
      <span
        className="cat-icon-text-pill"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: Math.max(9, Math.round(height * 0.62)),
          fontWeight: 800,
          letterSpacing: '0.02em',
          lineHeight: 1,
          padding: '1px 3px',
          borderRadius: 'var(--radius-sm, 4px)',
          background: 'color-mix(in srgb, currentColor 14%, transparent)'
        }}
      >
        {meta.iconText.trim().slice(0, 4)}
      </span>
    )
  }

  if (!key) {
    key = (categoryId || '').toLowerCase()
  }

  // Tự động phân định hướng nhân vật hoặc động vật nếu icon là 'user' chung chung nhưng id chỉ rõ
  if ((key === 'user' || key === 'character') && categoryId) {
    const cid = categoryId.toLowerCase()
    if (cid.includes('quarter')) {
      key = 'user-quarter'
    } else if (cid.includes('back')) {
      key = 'user-back'
    } else if (cid.includes('front') || cid.includes('hero') || cid.includes('male') || cid.includes('boy')) {
      key = 'user-male'
    } else if (cid.includes('anime') || cid.includes('female') || cid.includes('girl')) {
      key = 'user-female'
    }
  }

  switch (key) {
    case 'user-quarter':
    case 'character_human_quarter':
      return <IconUserQuarter width={width} height={height} />
    case 'user-back':
    case 'character_human_back':
      return <IconUserBack width={width} height={height} />
    case 'paw':
    case 'animal':
    case 'animal_modular':
      return <IconAnimalPaw width={width} height={height} />
    case 'user-male':
    case 'male':
    case 'hero':
    case 'character_hero':
    case 'character_human_front':
      return <IconUserMale width={width} height={height} />
    case 'user-female':
    case 'female':
    case 'anime':
    case 'character_anime':
    case 'girl':
      return <IconUserFemale width={width} height={height} />
    case 'tree':
    case 'nature':
    case 'plant':
    case 'grass':
      return <IconTree width={width} height={height} />
    case 'user':
    case 'character':
    case 'person':
    case 'creature':
      return <IconUser width={width} height={height} />
    case 'room':
    case 'interior':
    case 'furniture':
      return <IconArmchair width={width} height={height} />
    case 'decor':
    case 'ornament':
    case 'flower':
      return <IconDecor width={width} height={height} />
    case 'home':
    case 'house':
    case 'architecture':
      return <IconHome width={width} height={height} />
    case 'vehicle':
    case 'car':
    case 'transport':
      return <IconCarVehicle width={width} height={height} />
    case 'city':
    case 'building':
    case 'urban':
    case 'street':
      return <IconCity width={width} height={height} />
    case 'flame':
    case 'fire':
    case 'heat':
      return <IconFlame width={width} height={height} />
    case 'lightning':
    case 'electric':
    case 'plasma':
    case 'sfx':
      return <IconLightning width={width} height={height} />
    case 'voice':
    case 'mic':
    case 'speech':
      return <IconVoiceMic width={width} height={height} />
    case 'cinematic':
    case 'clapper':
    case 'whoosh':
      return <IconCinematicClapper width={width} height={height} />
    case 'demos':
    case 'sparkles':
    case 'vfx':
    case 'effect':
    case 'magic':
    case 'ambient':
      return <IconSparkles width={width} height={height} />
    case 'audio':
    case 'music':
    case 'sound':
      return <IconMusic width={width} height={height} />
    case 'grid-3d':
    case 'models-all':
      return <IconGrid3D width={width} height={height} />
    case 'cube':
    case '3d':
    case 'box':
      return <IconCube width={width} height={height} />
    case 'prop':
    case 'props':
    case 'lamp':
      return <IconPropLamp width={width} height={height} />
    case 'layers':
    case 'composite':
    case 'stack':
    case 'scene':
      return <IconLayersStack width={width} height={height} />
    case 'film':
    case 'video':
      return <IconFilm width={width} height={height} />
    case 'image':
    case 'picture':
      return <IconImage width={width} height={height} />
    case 'folder':
    case 'custom':
      return <IconFolder width={width} height={height} />
    case 'all':
    case 'grid':
      return <IconGrid width={width} height={height} />
    default:
      if (meta?.iconText?.trim()) {
        return (
          <span
            className="cat-icon-text-pill"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: Math.max(9, Math.round(height * 0.62)),
              fontWeight: 800,
              lineHeight: 1
            }}
          >
            {meta.iconText.trim().slice(0, 4)}
          </span>
        )
      }
      return <IconGrid width={width} height={height} />
  }
}
