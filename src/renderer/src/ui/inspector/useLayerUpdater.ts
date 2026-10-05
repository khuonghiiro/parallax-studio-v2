import type { Layer } from '@shared/types'
import { useEditor } from '../../store/editor'
import type { Setter } from './types'

export function useLayerUpdater(id: string): Setter {
  const update = useEditor((s) => s.update)
  return (fn: (l: Layer) => void, mergeKey?: string) =>
    update((d) => {
      const l = d.layers.find((x) => x.id === id)
      if (l) fn(l as Layer)
    }, mergeKey && `${id}-${mergeKey}`)
}
