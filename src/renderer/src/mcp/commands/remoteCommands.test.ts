import { beforeEach, describe, expect, it } from 'vitest'
import { createProject, createShot, createSolidLayer } from '../../project/factory'
import { useEditor } from '../../store/editor'
import { buildQrSvgPath, encodeQrMatrix } from '../../ui/remote/qrCodeSvg'
import { runCommand } from '../commands'

describe('MCP remoteCommands & QR Code encoder', () => {
  beforeEach(() => {
    const proj = createProject()
    const shot = createShot('Cảnh Mở Đầu', [0, 0, 0], 0)
    const layer = createSolidLayer(proj.comp)
    layer.name = 'Nền Đêm'
    layer.shotId = shot.id
    layer.transform.position.value = [0, 0, -200]
    proj.camera.position.value = [0, 0, 900]
    proj.camera.target.value = [0, 0, 0]
    proj.camera.fov.value = 45
    proj.shots = [shot]
    proj.layers = [layer]
    useEditor.getState().loadProject(proj, null)
    useEditor.getState().selectShot(shot.id)
    useEditor.getState().selectLayer(layer.id)
    useEditor.getState().setTime(0)
    useEditor.getState().setPlaying(false)
  })

  it('returns compact remote state via get_remote_state', async () => {
    const state = (await runCommand('get_remote_state')) as any
    expect(state.comp.name).toBeTruthy()
    expect(state.shots.length).toBe(1)
    expect(state.layers.length).toBe(1)
    expect(state.selectedShotId).toBe(state.shots[0].id)
    expect(state.selectedLayerId).toBe(state.layers[0].id)
    expect(state.camera.position[2]).toBe(900)
    expect(state.camera.fov).toBe(45)
  })

  it('handles playback and seek via remote_control_action', async () => {
    const toggled = (await runCommand('remote_control_action', {
      action: 'toggle_play'
    })) as any
    expect(toggled.playing).toBe(true)

    const paused = (await runCommand('remote_control_action', {
      action: 'pause'
    })) as any
    expect(paused.playing).toBe(false)

    const seeked = (await runCommand('remote_control_action', {
      action: 'seek',
      time: 2.45
    })) as any
    expect(seeked.time).toBeCloseTo(2.45, 2)
  })

  it('nudges and updates 3D camera via pan, dolly, orbit, and set_camera_transform', async () => {
    const panned = (await runCommand('remote_control_action', {
      action: 'nudge_camera',
      mode: 'pan',
      dx: 25,
      dy: -15
    })) as any
    expect(panned.camera.position[0]).toBe(25)
    expect(panned.camera.target[0]).toBe(25)
    expect(panned.camera.position[1]).toBe(-15)
    expect(panned.camera.target[1]).toBe(-15)

    const dollied = (await runCommand('remote_control_action', {
      action: 'nudge_camera',
      mode: 'dolly',
      dz: -100,
      dfov: 5
    })) as any
    expect(dollied.camera.position[2]).toBe(800)
    expect(dollied.camera.fov).toBe(50)

    const orbited = (await runCommand('remote_control_action', {
      action: 'nudge_camera',
      mode: 'orbit',
      dx: 15,
      dy: 10
    })) as any
    expect(orbited.camera.position[0]).not.toBe(25)
    expect(orbited.camera.target[0]).toBe(25)

    const setDirect = (await runCommand('remote_control_action', {
      action: 'set_camera_transform',
      z: 1100,
      fov: 38
    })) as any
    expect(setDirect.camera.position[2]).toBe(1100)
    expect(setDirect.camera.fov).toBe(38)

    const reset = (await runCommand('remote_control_action', {
      action: 'reset_camera'
    })) as any
    expect(reset.camera.position).toEqual([0, 0, 1200])
    expect(reset.camera.target).toEqual([0, 0, 0])
    expect(reset.camera.fov).toBe(50)
  })

  it('nudges and updates 3D layer transform, visibility, keyframes, and undo/redo', async () => {
    const nudged = (await runCommand('remote_control_action', {
      action: 'nudge_layer',
      dx: 30,
      dy: -20,
      dz: 50,
      drz: 12,
      ds: 0.25,
      dopacity: -0.2
    })) as any
    const layer = nudged.layers[0]
    expect(layer.position).toEqual([30, -20, -150])
    expect(layer.rotation[2]).toBe(12)
    expect(layer.scale[0]).toBeCloseTo(1.25, 2)
    expect(layer.opacity).toBeCloseTo(0.8, 2)

    const toggledVis = (await runCommand('remote_control_action', {
      action: 'toggle_layer_visible'
    })) as any
    expect(toggledVis.layers[0].visible).toBe(false)

    // Undo brings visibility back to true
    const undone = (await runCommand('remote_control_action', {
      action: 'undo'
    })) as any
    expect(undone.layers[0].visible).toBe(true)

    // Redo re-applies visibility false
    const redone = (await runCommand('remote_control_action', {
      action: 'redo'
    })) as any
    expect(redone.layers[0].visible).toBe(false)

    // Keyframe creation
    const kfState = (await runCommand('remote_control_action', {
      action: 'keyframe'
    })) as any
    expect(kfState.layers[0].hasKeyframes).toBe(true)
    expect(useEditor.getState().project.layers[0].transform.position.keyframes.length).toBeGreaterThan(0)
  })

  it('encodes valid ISO/IEC 18004 QR Code matrices and SVG paths for LAN URLs', () => {
    const url = 'http://192.168.1.105:9878/?t=8f9e0a1b2c3d4e5f'
    const matrix = encodeQrMatrix(url)
    expect(matrix.length).toBeGreaterThanOrEqual(29)
    expect(matrix[0].length).toBe(matrix.length)

    // Top-left finder pattern outer ring corners must be dark (true)
    expect(matrix[0][0]).toBe(true)
    expect(matrix[0][6]).toBe(true)
    expect(matrix[6][0]).toBe(true)
    expect(matrix[6][6]).toBe(true)
    expect(matrix[3][3]).toBe(true)
    // Quiet zone separator around top-left finder must be light (false)
    expect(matrix[7][0]).toBe(false)
    expect(matrix[0][7]).toBe(false)

    const { viewBoxSize, pathData } = buildQrSvgPath(matrix, 3)
    expect(viewBoxSize).toBe(matrix.length + 6)
    expect(pathData).toContain('M3,3h1v1h-1z')
  })
})
