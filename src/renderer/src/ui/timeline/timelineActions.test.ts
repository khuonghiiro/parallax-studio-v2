import { beforeEach, describe, expect, it } from 'vitest'
import { useEditor } from '../../store/editor'
import { createProject } from '../../project/factory'
import { replaceLayerAsset } from '../../actions'
import {
  addKeyframeForSelectedLayer,
  resetSelectedLayerTiming,
  setSelectedLayerInPoint,
  setSelectedLayerOutPoint,
  splitSelectedLayer
} from './timelineActions'
import type { ImageLayer } from '@shared/types'

describe('Timeline Actions: Split, In/Out Points, and Keyframe Creation', () => {
  beforeEach(() => {
    const proj = createProject({ width: 1920, height: 1080, duration: 8, fps: 30 })
    proj.assets.push({
      id: 'asset-1',
      name: 'first_image.png',
      kind: 'image',
      mime: 'image/png',
      width: 1920,
      height: 1080
    })
    const testLayer: ImageLayer = {
      id: 'layer-test-1',
      type: 'image',
      name: 'Layer Thử Nghiệm',
      visible: true,
      locked: false,
      inPoint: 1.0,
      outPoint: 7.0,
      blendMode: 'normal',
      autoScale: false,
      shotId: null,
      transform: {
        position: { value: [0, 0, 500], keyframes: [] },
        rotation: { value: [0, 0, 0], keyframes: [] },
        scale: { value: [1, 1, 1], keyframes: [] },
        opacity: { value: 1, keyframes: [] }
      },
      props: {
        assetId: 'asset-1',
        width: 1920,
        height: 1080
      }
    }
    proj.layers = [testLayer]
    useEditor.setState({
      project: proj,
      time: 3.0,
      selectedLayerId: 'layer-test-1'
    })
  })

  it('sets In-point correctly at current playhead time', () => {
    useEditor.setState({ time: 2.5 })
    const ok = setSelectedLayerInPoint()
    expect(ok).toBe(true)

    const layer = useEditor.getState().project.layers.find((l) => l.id === 'layer-test-1')
    expect(layer?.inPoint).toBe(2.5)
  })

  it('sets Out-point correctly at current playhead time', () => {
    useEditor.setState({ time: 5.5 })
    const ok = setSelectedLayerOutPoint()
    expect(ok).toBe(true)

    const layer = useEditor.getState().project.layers.find((l) => l.id === 'layer-test-1')
    expect(layer?.outPoint).toBe(5.5)
  })

  it('splits layer into two segments at current playhead time', () => {
    useEditor.setState({ time: 4.0 })
    const ok = splitSelectedLayer()
    expect(ok).toBe(true)

    const layers = useEditor.getState().project.layers
    expect(layers.length).toBe(2)

    const first = layers[0]
    const second = layers[1]

    expect(first.id).toBe('layer-test-1')
    expect(first.inPoint).toBe(1.0)
    expect(first.outPoint).toBe(4.0)

    expect(second.inPoint).toBe(4.0)
    expect(second.outPoint).toBe(7.0)
    expect(second.name).toContain('phần 2')
    expect(useEditor.getState().selectedLayerId).toBe(second.id)
  })

  it('adds a keyframe at current playhead time', () => {
    useEditor.setState({ time: 3.5 })
    const ok = addKeyframeForSelectedLayer()
    expect(ok).toBe(true)

    const layer = useEditor.getState().project.layers.find((l) => l.id === 'layer-test-1')
    expect(layer?.transform.position.keyframes.length).toBe(1)
    expect(layer?.transform.position.keyframes[0].t).toBe(3.5)
    expect(layer?.transform.position.keyframes[0].value).toEqual([0, 0, 500])
  })

  it('resets in/out timing to full composition duration', () => {
    const ok = resetSelectedLayerTiming()
    expect(ok).toBe(true)

    const layer = useEditor.getState().project.layers.find((l) => l.id === 'layer-test-1')
    expect(layer?.inPoint).toBe(0)
    expect(layer?.outPoint).toBe(8)
  })

  it('splits layer at 3.0s and seamlessly replaces source image of second segment', () => {
    const proj = useEditor.getState().project
    proj.assets.push({
      id: 'asset-2',
      name: 'second_character.png',
      kind: 'image',
      mime: 'image/png',
      width: 800,
      height: 1200
    })

    useEditor.setState({ time: 3.0 })
    const splitOk = splitSelectedLayer()
    expect(splitOk).toBe(true)

    const layers = useEditor.getState().project.layers
    expect(layers.length).toBe(2)
    const [first, second] = layers as [ImageLayer, ImageLayer]
    expect(first.outPoint).toBe(3.0)
    expect(second.inPoint).toBe(3.0)
    expect(second.props.assetId).toBe('asset-1')

    // Now replace the asset of the second layer segment
    const replaceOk = replaceLayerAsset(second.id, 'asset-2')
    expect(replaceOk).toBe(true)

    const updatedSecond = useEditor.getState().project.layers[1] as ImageLayer
    expect(updatedSecond.props.assetId).toBe('asset-2')
    expect(updatedSecond.props.width).toBe(800)
    expect(updatedSecond.props.height).toBe(1200)
    expect(updatedSecond.name).toBe('second_character.png')
    // 3D position, depth Z=500, keyframes, in/out timing remain 100% intact
    expect(updatedSecond.transform.position.value).toEqual([0, 0, 500])
    expect(updatedSecond.inPoint).toBe(3.0)
    expect(updatedSecond.outPoint).toBe(7.0)
  })
})

