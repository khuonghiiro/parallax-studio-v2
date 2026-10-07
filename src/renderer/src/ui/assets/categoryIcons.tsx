import type { ReactNode } from 'react'
import {
  IconCity,
  IconCube,
  IconFilm,
  IconFolder,
  IconGrid,
  IconHome,
  IconImage,
  IconMusic,
  IconSparkles
} from '../icons'

export function renderCategoryIcon(iconKey: string, width = 16, height = 16): ReactNode {
  switch (iconKey?.toLowerCase()) {
    case 'home':
    case 'house':
    case 'architecture':
    case 'room':
      return <IconHome width={width} height={height} />
    case 'city':
    case 'building':
    case 'urban':
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
      return <IconCube width={width} height={height} />
    case 'film':
    case 'video':
      return <IconFilm width={width} height={height} />
    case 'image':
    case 'picture':
      return <IconImage width={width} height={height} />
    case 'folder':
      return <IconFolder width={width} height={height} />
    case 'all':
    case 'grid':
    default:
      return <IconGrid width={width} height={height} />
  }
}
