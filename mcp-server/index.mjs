#!/usr/bin/env node
/**
 * Parallax Studio MCP server (stdio).
 *
 * Lets an AI client (Antigravity, Claude Desktop, Cursor…) drive a running Parallax
 * Studio window, the same way blender-mcp drives Blender. This process only speaks
 * MCP on stdio and relays each tool call to the app's local bridge
 * (127.0.0.1, token from <userData>/parallax-studio/mcp.json).
 *
 * Never write to stdout here except through the MCP transport — logs go to stderr.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { createConnection } from 'node:net'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve, isAbsolute } from 'node:path'

const log = (...a) => console.error('[parallax-mcp]', ...a)

// ------------------------------------------------------------------ bridge client

function configPath() {
  if (process.env.PARALLAX_MCP_CONFIG) return process.env.PARALLAX_MCP_CONFIG
  const appName = 'parallax-studio'
  if (process.platform === 'win32') return join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), appName, 'mcp.json')
  if (process.platform === 'darwin') return join(homedir(), 'Library', 'Application Support', appName, 'mcp.json')
  return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), appName, 'mcp.json')
}

function readConfig() {
  const p = configPath()
  let cfg
  try {
    cfg = JSON.parse(readFileSync(p, 'utf8'))
  } catch {
    throw new Error(`Parallax Studio is not running (or has never been started): cannot read ${p}. Start the app with "npm run dev" first.`)
  }
  return {
    host: '127.0.0.1', // never connect anywhere else
    port: Number(process.env.PARALLAX_MCP_PORT) || cfg.port || 9877,
    token: process.env.PARALLAX_MCP_TOKEN || cfg.token
  }
}

class Bridge {
  sock = null
  buf = ''
  seq = 0
  pending = new Map()
  connecting = null

  connect() {
    if (this.sock && !this.sock.destroyed) return Promise.resolve()
    if (this.connecting) return this.connecting
    const cfg = readConfig()
    this.token = cfg.token
    this.connecting = new Promise((res, rej) => {
      const s = createConnection({ host: cfg.host, port: cfg.port })
      s.setEncoding('utf8')
      s.once('connect', () => {
        this.sock = s
        this.connecting = null
        res()
      })
      s.once('error', (err) => {
        this.connecting = null
        rej(new Error(`Cannot reach Parallax Studio on ${cfg.host}:${cfg.port} (${err.code ?? err.message}). Is the app open?`))
      })
      s.on('data', (chunk) => this.onData(chunk))
      s.on('close', () => {
        if (this.sock === s) this.sock = null
        for (const [, p] of this.pending) p.reject(new Error('Connection to Parallax Studio closed'))
        this.pending.clear()
      })
    })
    return this.connecting
  }

  onData(chunk) {
    this.buf += chunk
    let nl
    while ((nl = this.buf.indexOf('\n')) >= 0) {
      const line = this.buf.slice(0, nl)
      this.buf = this.buf.slice(nl + 1)
      if (!line.trim()) continue
      let msg
      try {
        msg = JSON.parse(line)
      } catch {
        log('bad line from app', line.slice(0, 200))
        continue
      }
      const p = this.pending.get(msg.id)
      if (!p) continue
      this.pending.delete(msg.id)
      if (msg.ok) p.resolve(msg.result)
      else p.reject(new Error(msg.error ?? 'Command failed'))
    }
  }

  async call(method, params = {}) {
    await this.connect()
    const id = ++this.seq
    return new Promise((res, rej) => {
      this.pending.set(id, { resolve: res, reject: rej })
      this.sock.write(JSON.stringify({ id, token: this.token, method, params }) + '\n')
    })
  }
}

const bridge = new Bridge()

// ------------------------------------------------------------------ schemas

const vec3 = z.tuple([z.number(), z.number(), z.number()])
const ease = z.enum(['linear', 'easeIn', 'easeOut', 'easeInOut', 'easeInOutStrong', 'hold'])
const blend = z.enum(['normal', 'add', 'screen', 'multiply'])
const shotId = z
  .string()
  .nullable()
  .optional()
  .describe('Owning shot id (or shot name). null/"global" = global layer visible from every shot. Omit = currently selected shot.')
const atTime = z.number().optional().describe('If set, write a keyframe at this time (s) instead of changing the static value.')

const layerCommon = {
  shot_id: shotId,
  name: z.string().optional(),
  position: vec3.optional().describe('LOCAL position inside the shot [x, y, z]; z = depth, positive = farther.'),
  z: z.number().optional().describe('Shortcut to set only the depth.'),
  rotation: vec3.optional().describe('Degrees [x, y, z].'),
  scale: z.union([z.number(), vec3]).optional().describe('Number (uniform) or [x, y, z]. 1 = 100%.'),
  opacity: z.number().min(0).max(1).optional(),
  blend_mode: blend.optional(),
  auto_scale: z.boolean().optional().describe('Keep apparent size constant when pushed in depth (default true).'),
  in_point: z.number().optional(),
  out_point: z.number().optional(),
  visible: z.boolean().optional()
}

/** Make relative paths absolute against this process's cwd (the app has a different cwd). */
function absPaths(args) {
  const out = { ...args }
  for (const k of ['file_path', 'out_path', 'path']) if (typeof out[k] === 'string' && out[k] && !isAbsolute(out[k])) out[k] = resolve(out[k])
  return out
}

const text = (v) => ({ content: [{ type: 'text', text: typeof v === 'string' ? v : JSON.stringify(v, null, 2) }] })

// ------------------------------------------------------------------ server

const server = new McpServer(
  { name: 'parallax-studio', version: '0.1.0' },
  {
    instructions: [
      'Parallax Studio is a 2.5D motion tool: image/text/solid/particle layers are placed in 3D depth and filmed by an animated camera, then exported to MP4.',
      'World units = composition pixels. x → right, y → up, z → DEPTH (positive = farther from the viewer, like After Effects).',
      'A project contains SHOTS (scenes) placed far apart in world space (see shot_spacing). Layer transforms are LOCAL to their shot.',
      "Inside a shot, its framing camera sits at local (0, 0, -reference_distance) looking at the origin, so a layer at z = 0 with scale 1 appears at its native pixel size; farther layers (z > 0) move less = parallax. Typical plate depths: sky 3000+, mountains 1000–2500, midground 300–800, foreground -300–0.",
      'The camera only loads/renders what it sees, so many shots are cheap. Typical workflow: get_project_info → add_shot → add_image_layer/add_text_layer/add_particles per shot → build_camera_path to fly between shots → get_viewport_screenshot (view "camera" or "3d") to check → export_video.',
      'All edits are undoable in the app (undo tool / Ctrl+Z). Times are in seconds.'
    ].join('\n')
  }
)

function tool(name, description, shape, opts = {}) {
  server.registerTool(name, { title: opts.title, description, inputSchema: shape }, async (args) => {
    try {
      const result = await bridge.call(opts.method ?? name, absPaths(args ?? {}))
      return opts.format ? opts.format(result, args) : text(result)
    } catch (err) {
      return { isError: true, content: [{ type: 'text', text: String(err?.message ?? err) }] }
    }
  })
}

// ---- inspect
tool('get_project_info', 'Overview of the open project: composition, shots (with framing camera), layers (summaries), camera, look, audio, assets, selection.', {})
tool('get_shot_info', 'Details of one shot and its layers.', { shot_id: z.string(), time: z.number().optional() })
tool('get_layer_info', 'Full JSON of one layer, including all keyframes and props.', { layer_id: z.string() })
tool('get_camera_info', 'Camera state evaluated at a time (default: current time) plus all camera keyframes and which shot it looks at.', {
  time: z.number().optional()
})
tool('get_memory_stats', 'Texture residency (what the camera has loaded), GPU texture MB vs budget, JS heap and per-process RAM.', {})
tool(
  'get_viewport_screenshot',
  'Render a picture of the scene. view "camera" = final output frame at `time`; view "3d" = orbit overview of all shots, layers, camera and its path (like After Effects custom view).',
  {
    view: z.enum(['camera', '3d']).optional(),
    time: z.number().optional(),
    width: z.number().int().min(64).max(3840).optional().describe('Default 960.'),
    format: z.enum(['png', 'jpeg']).optional(),
    shot_id: z.string().optional().describe('3d view only: frame just this shot.'),
    yaw: z.number().optional().describe('3d view only: orbit angle in degrees (default -35).'),
    pitch: z.number().optional().describe('3d view only: elevation in degrees (default 22).')
  },
  {
    format: (r) => ({
      content: [
        { type: 'image', data: r.data, mimeType: r.mime },
        { type: 'text', text: `${r.view} view · t=${r.time}s · ${r.width}×${r.height} · textures ${r.stats?.textures} (${r.stats?.textureMB} MB)` }
      ]
    })
  }
)

// ---- project
tool('new_project', 'Start an empty project (discards unsaved changes without asking).', {
  name: z.string().optional(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  fps: z.number().optional(),
  duration: z.number().optional(),
  background: z.string().optional()
})
tool('set_composition', 'Change composition settings. Changing duration extends/trims layers that ran to the old end.', {
  name: z.string().optional(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  fps: z.number().optional(),
  duration: z.number().optional(),
  background: z.string().optional()
})
tool('save_project', 'Save the project as a .pxs file (images and audio embedded).', {
  path: z.string().optional().describe('Absolute path ending in .pxs. Omit to overwrite the current file.')
})
tool('open_project', 'Open a .pxs project file.', { file_path: z.string() })
tool('undo', 'Undo the last edit.', {})
tool('redo', 'Redo.', {})

// ---- shots
tool('add_shot', 'Create a new shot (scene). By default it is placed to the right of the existing shots.', {
  name: z.string().optional(),
  direction: z.enum(['right', 'down', 'depth']).optional(),
  position: vec3.optional().describe('Explicit world position (overrides direction).'),
  rotation: vec3.optional(),
  color: z.string().optional(),
  adopt_global_layers: z.boolean().optional().describe('Move all current global layers into this shot.')
})
tool('update_shot', 'Rename / recolor / hide a shot or move it in world space.', {
  shot_id: z.string(),
  name: z.string().optional(),
  color: z.string().optional(),
  visible: z.boolean().optional(),
  position: vec3.optional(),
  rotation: vec3.optional(),
  at_time: atTime,
  ease: ease.optional()
})
tool('delete_shot', 'Delete a shot. Its layers are deleted too unless keep_layers is true (they become global).', {
  shot_id: z.string(),
  keep_layers: z.boolean().optional()
})

// ---- layers
tool(
  'add_image_layer',
  'Add an image (PNG with transparency works best for parallax plates) as a layer. Provide file_path (absolute) or image_base64.',
  {
    file_path: z.string().optional(),
    image_base64: z.string().optional().describe('Raw base64 or data: URL.'),
    file_name: z.string().optional(),
    fit: z.enum(['cover', 'contain', 'native']).optional().describe('Initial scale vs the composition. Default: cover for large images, native otherwise.'),
    ...layerCommon
  }
)
tool('add_text_layer', 'Add a text layer (titles, captions).', {
  text: z.string(),
  font_family: z.string().optional().describe('e.g. Montserrat, Inter, Playfair Display, Bebas Neue, JetBrains Mono'),
  font_size: z.number().optional(),
  font_weight: z.number().optional(),
  color: z.string().optional(),
  letter_spacing: z.number().optional(),
  shadow: z.boolean().optional(),
  ...layerCommon
})
tool('add_solid_layer', 'Add a solid color or vertical gradient plane (backgrounds, color washes). Added at the bottom of the shot stack.', {
  color: z.string().optional(),
  color2: z.string().optional(),
  gradient: z.boolean().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  ...layerCommon
})
tool('add_particles', 'Add a particle field (fireflies, snow, dust, embers). Deterministic for a given seed.', {
  count: z.number().int().optional(),
  seed: z.number().int().optional(),
  size: z.number().optional(),
  color: z.string().optional(),
  area: vec3.optional().describe('Emission box size in world units.'),
  velocity: vec3.optional().describe('Units per second; snow ≈ [0, -40, 0].'),
  sway: z.number().optional(),
  twinkle: z.boolean().optional(),
  glow: z.boolean().optional(),
  ...layerCommon
})
tool(
  'update_layer',
  'Change a layer. Transform values follow After Effects rules: animated properties get a keyframe at the current time (or at_time); static ones change value. props = raw prop overrides (text, color, fontSize…).',
  {
    layer_id: z.string(),
    ...layerCommon,
    locked: z.boolean().optional(),
    props: z.record(z.string(), z.any()).optional(),
    text: z.string().optional(),
    color: z.string().optional(),
    font_size: z.number().optional(),
    at_time: atTime,
    ease: ease.optional()
  }
)
tool('delete_layer', 'Delete a layer.', { layer_id: z.string() })
tool('move_layer', 'Move a layer up/down in its shot stack (affects draw order at equal depth).', {
  layer_id: z.string(),
  direction: z.enum(['up', 'down'])
})

// ---- keyframes
const keyTarget = {
  target: z.enum(['layer', 'camera', 'shot']),
  id: z.string().optional().describe('Layer id or shot id (not needed for camera).'),
  property: z
    .string()
    .describe('layer: position|rotation|scale|opacity · camera: position|target|fov|focus_distance|aperture|fade · shot: position|rotation')
}
tool('set_keyframe', 'Add or replace a keyframe. value is a number (opacity, fov, focus_distance, aperture, fade) or [x, y, z].', {
  ...keyTarget,
  time: z.number().optional().describe('Seconds; default current time.'),
  value: z.union([z.number(), vec3]),
  ease: ease.optional().describe('Easing of the segment that starts at this key. hold = jump cut.')
})
tool('remove_keyframe', 'Remove one keyframe by key_id or time.', { ...keyTarget, key_id: z.string().optional(), time: z.number().optional() })
tool('clear_keyframes', 'Remove all keyframes of a property (or of every property of the target if property is omitted). The value at the current time is kept.', {
  target: z.enum(['layer', 'camera', 'shot']),
  id: z.string().optional(),
  property: z.string().optional()
})

// ---- camera
tool('set_camera', 'Set camera properties (world space). Animated properties get a key at the current time (or at_time).', {
  position: vec3.optional(),
  target: vec3.optional().describe('Point the camera looks at.'),
  fov: z.number().optional(),
  focus_distance: z.number().optional(),
  aperture: z.number().optional().describe('Depth-of-field blur strength (0–1).'),
  fade: z.number().min(0).max(1).optional().describe('Fade to black.'),
  dof_enabled: z.boolean().optional(),
  shake_amount: z.number().optional(),
  shake_speed: z.number().optional(),
  at_time: atTime,
  ease: ease.optional()
})
tool('apply_camera_preset', 'Replace the camera move with a classic preset, framed on a shot.', {
  preset: z.enum(['dollyIn', 'dollyOut', 'truckLeft', 'truckRight', 'craneUp', 'craneDown', 'orbitLeft', 'orbitRight', 'zoomIn', 'dollyZoom', 'reset']),
  shot_id: z.string().optional(),
  start: z.number().optional(),
  end: z.number().optional(),
  intensity: z.number().optional().describe('1 = default amount.')
})
tool('camera_fly_to_shot', 'Key the camera to frame a shot at `time` (After Effects style "fly here"). With duration, the move starts duration seconds earlier.', {
  shot_id: z.string(),
  time: z.number().optional(),
  duration: z.number().optional(),
  ease: ease.optional()
})
tool(
  'build_camera_path',
  'Replace the camera animation with a tour through shots: hold on each shot (slow push-in), then transition to the next. Sets the comp duration to fit by default.',
  {
    steps: z
      .array(
        z.object({
          shot_id: z.string(),
          hold: z.number().optional().describe('Seconds on this shot (default 3).'),
          transition: z.enum(['fly', 'arc', 'cut', 'fade']).optional().describe('Transition INTO the next step.'),
          transition_duration: z.number().optional()
        })
      )
      .min(1),
    push_in: z.number().min(0).max(0.5).optional(),
    start_at: z.number().optional(),
    fit_duration: z.boolean().optional()
  }
)

// ---- look / audio / time / view
tool('set_look', 'Global grading & atmosphere.', {
  fog_enabled: z.boolean().optional(),
  fog_color: z.string().optional(),
  fog_near: z.number().optional(),
  fog_far: z.number().optional(),
  vignette: z.number().optional(),
  grain: z.number().optional(),
  exposure: z.number().optional(),
  contrast: z.number().optional(),
  saturation: z.number().optional()
})
tool('set_audio', 'Set the soundtrack from an audio file, adjust offset/volume, or remove it.', {
  file_path: z.string().optional(),
  offset: z.number().optional().describe('Seconds; positive delays the audio.'),
  volume: z.number().min(0).max(1).optional(),
  remove: z.boolean().optional()
})
tool('set_time', 'Move the playhead (the user sees it in the app).', { time: z.number() })
tool('set_playing', 'Start/stop playback in the app.', { playing: z.boolean() })
tool('select', 'Select a layer or shot in the app UI (omit both to clear).', { layer_id: z.string().optional(), shot_id: z.string().optional() })
tool('set_view', "Change the app's viewer for the user: camera view, 3D view or split; frame a shot.", {
  mode: z.enum(['camera', '3d', 'split']).optional(),
  focus: z.string().optional().describe('"all", "selection" or a shot id.'),
  camera_only: z.boolean().optional().describe('3D view previews only what the camera loads.'),
  show_path: z.boolean().optional()
})

// ---- export & scripting
tool('export_video', 'Render the composition to an H.264 MP4 (blocks until finished).', {
  out_path: z.string().describe('Absolute path ending in .mp4'),
  height: z.number().int().optional().describe('Output height (width follows aspect). Default: comp height.'),
  fps: z.number().optional(),
  crf: z.number().optional().describe('Quality, lower = better (default 18).'),
  preset: z.enum(['ultrafast', 'veryfast', 'medium', 'slow']).optional(),
  with_audio: z.boolean().optional(),
  start: z.number().optional(),
  end: z.number().optional()
})
tool(
  'execute_script',
  'Run JavaScript inside the app (async). Available: api.project, api.time, api.update(draft => {...}) for undoable edits, await api.run(method, params) to call any tool, api.factory, api.keyframes, api.THREE, log(...). Return a JSON-serializable value.',
  { code: z.string() }
)

// ------------------------------------------------------------------ start

const transport = new StdioServerTransport()
await server.connect(transport)
log(`ready · config ${configPath()}`)
