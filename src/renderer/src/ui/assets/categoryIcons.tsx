import type { ReactNode } from 'react'
import {
  IconArmchair,
  IconCity,
  IconCube,
  IconDecor,
  IconFilm,
  IconFolder,
  IconGrid,
  IconHome,
  IconImage,
  IconLayersStack,
  IconMusic,
  IconSparkles,
  IconTree,
  IconUser
} from '../icons'

export function renderCategoryIcon(iconKey: string, width = 16, height = 16): ReactNode {
  switch (iconKey?.toLowerCase()) {
    case 'tree':
    case 'nature':
    case 'plant':
    case 'grass':
      return <IconTree width={width} height={height} />
    case 'user':
    case 'character':
    case 'person':
    case 'creature':
    case 'hero':
    case 'anime':
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
    case 'city':
    case 'building':
    case 'urban':
    case 'street':
      return <IconCity width={width} height={height} />
    case 'demos':
    case 'sparkles':
    case 'vfx':
    case 'effect':
    case 'magic':
      return <IconSparkles width={width} height={height} />
    case 'audio':
    case 'music':
    case 'sound':
      return <IconMusic width={width} height={height} />
    case 'cube':
    case '3d':
    case 'prop':
    case 'props':
      return <IconCube width={width} height={height} />
    case 'layers':
    case 'composite':
    case 'stack':
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
    default:
      return <IconGrid width={width} height={height} />
  }
}
