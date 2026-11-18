import { describe, expect, it } from 'vitest'
import { useView, type PrimaryView } from './view'
import { selectedViews } from '../ui/viewer/taggedLayout'

describe('focus preserves viewer choices', () => {
  const views: PrimaryView[] = ['camera', 'node2d', 'editor', 'animate2d', 'topview']
  it('preserves every nonempty combination through layer, shot and selection focus', () => {
    for (let mask = 1; mask < 32; mask++) {
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
  it('opens and toggles node2d stage alongside camera cleanly', () => {
    useView.setState({ activeViews: ['camera'], primary: 'camera', split: false })
    useView.getState().openNodeStage2D('split_or_open')
    expect(selectedViews(useView.getState())).toEqual(['camera', 'node2d'])
    expect(useView.getState().primary).toBe('node2d')
    useView.getState().openNodeStage2D('toggle')
    expect(selectedViews(useView.getState())).toEqual(['camera'])
    useView.getState().openNodeStage2D('solo')
    expect(selectedViews(useView.getState())).toEqual(['node2d'])
  })
  it('preserves legacy camera-only preferences', () => {
    useView.setState({ activeViews: undefined, primary: 'camera', split: false })
    useView.getState().requestFocus('layer', 'target')
    expect(selectedViews(useView.getState())).toEqual(['camera'])
    expect(useView.getState().primary).toBe('camera')
  })
})
