import { describe, expect, it } from 'vitest'
import { useView, type PrimaryView } from './view'
import { selectedViews } from '../ui/viewer/taggedLayout'

describe('focus preserves viewer choices', () => {
  const views: PrimaryView[] = ['camera', 'editor', 'animate2d', 'topview']
  it('preserves every nonempty combination through layer, shot and selection focus', () => {
    for (let mask = 1; mask < 16; mask++) {
      const activeViews = views.filter((_, i) => mask & (1 << i))
      useView.setState({ activeViews })
      for (const kind of ['layer', 'shot', 'selection', 'all'] as const) {
        const n = useView.getState().focus?.n ?? 0
        useView.getState().requestFocus(kind, 'target')
        expect(selectedViews(useView.getState())).toEqual(activeViews)
        expect(useView.getState().focus).toEqual({ kind, id: 'target', n: n + 1 })
      }
    }
  })
  it('preserves legacy camera-only preferences', () => {
    useView.setState({ activeViews: undefined, primary: 'camera', split: false })
    useView.getState().requestFocus('layer', 'target')
    expect(selectedViews(useView.getState())).toEqual(['camera'])
    expect(useView.getState().primary).toBe('camera')
  })
})
