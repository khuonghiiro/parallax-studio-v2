import type { AssetTable } from './types'
import { useLayerAssetImage } from './useLayerAssetImage'
import { IconImage } from '../icons'

/** Ảnh thu nhỏ nền caro cho layer / tài nguyên (giải alias '@x', data:, built-in). */
export function PartThumb({
  path,
  previewUrl,
  assets,
  size,
  className = ''
}: {
  path?: string
  previewUrl?: string
  assets?: AssetTable
  size?: 'lg'
  className?: string
}) {
  const isData = Boolean(path && (path.startsWith('data:') || path.startsWith('blob:')))
  const resolved = useLayerAssetImage(isData ? undefined : path, previewUrl || (isData ? path : undefined), assets)
  return (
    <span className={`lw-thumb${size ? ` ${size}` : ''}${className ? ` ${className}` : ''}`}>
      {resolved ? <img src={resolved} alt="" draggable={false} /> : <IconImage width={14} height={14} style={{ opacity: 0.4 }} />}
    </span>
  )
}
