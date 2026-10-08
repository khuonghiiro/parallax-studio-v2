import { ParamError, type Handler, type Params } from '../types'
import { num, str } from '../params'

/**
 * UI-level commands: let an AI see and drive the real app UI (dialogs, tabs, workshop),
 * not just the rendered scene. Screenshots come from the main process
 * (`webContents.capturePage`), so they match exactly what the user sees.
 */

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

const nextPaint = (): Promise<void> =>
  new Promise((r) => {
    if (typeof requestAnimationFrame !== 'function') return r()
    let done = false
    const finish = (): void => {
      if (!done) {
        done = true
        r()
      }
    }
    const timer = setTimeout(finish, 60)
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        clearTimeout(timer)
        finish()
      })
    )
  })

export interface UiCandidate {
  text: string
  visible: boolean
}

/**
 * Pick the element whose visible text matches `query` (case-insensitive).
 * Exact matches win over partial ones; `index` selects among equal matches.
 * Returns -1 when nothing matches.
 */
export function pickByText(candidates: UiCandidate[], query: string, index = 0): number {
  const q = query.trim().toLowerCase()
  if (!q) return -1
  const norm = candidates.map((c) => c.text.replace(/\s+/g, ' ').trim().toLowerCase())
  const exact: number[] = []
  const partial: number[] = []
  norm.forEach((t, i) => {
    if (!candidates[i].visible) return
    if (t === q) exact.push(i)
    else if (t.includes(q)) partial.push(i)
  })
  const pool = exact.length > 0 ? exact : partial
  return pool[Math.max(0, Math.min(pool.length - 1, index))] ?? -1
}

const CLICKABLE = 'button, [role="button"], [role="tab"], [role="menuitem"], a, summary, label, .c3d-card'

function isVisible(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
}

function findTarget(p: Params): HTMLElement {
  const selector = str(p, 'selector')
  const text = str(p, 'text')
  const index = Math.max(0, Math.round(num(p, 'index') ?? 0))
  if (!selector && !text) throw new ParamError('Provide "selector" or "text"')
  if (selector && !text) {
    const all = Array.from(document.querySelectorAll<HTMLElement>(selector)).filter(isVisible)
    if (!all[index]) throw new Error(`No visible element matches selector "${selector}"`)
    return all[index]
  }
  const scope = selector ? Array.from(document.querySelectorAll<HTMLElement>(selector)) : null
  const pool = scope ?? Array.from(document.querySelectorAll<HTMLElement>(CLICKABLE))
  const candidates = pool.map((el) => ({
    text: el.innerText || el.getAttribute('aria-label') || el.title || '',
    visible: isVisible(el)
  }))
  const i = pickByText(candidates, text!, index)
  if (i < 0) throw new Error(`No visible clickable element with text "${text}"`)
  return pool[i]
}

export const uiCommands: Record<string, Handler> = {
  get_app_screenshot: async (p) => {
    const capture = window.api?.mcp?.captureWindow
    if (!capture) throw new Error('Window capture is not available in this build')
    await sleep(Math.max(0, Math.min(5000, num(p, 'delay_ms') ?? 150)))
    await nextPaint()
    const width = num(p, 'width')
    const format = str(p, 'format') === 'jpeg' ? 'jpeg' : 'png'
    const res = await capture({ width: width ?? undefined, format })
    return { ...res, target: 'app-window' }
  },

  ui_click: async (p) => {
    const el = findTarget(p)
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    el.click()
    await nextPaint()
    return { clicked: el.tagName.toLowerCase(), text: (el.innerText || el.title || '').trim().slice(0, 120) }
  },

  ui_type: async (p) => {
    const el = findTarget({ ...p, text: undefined }) as HTMLInputElement
    if (!('value' in el)) throw new Error('Target is not an input/textarea')
    const value = str(p, 'value') ?? ''
    const proto = Object.getPrototypeOf(el) as object
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
    setter ? setter.call(el, value) : (el.value = value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    await nextPaint()
    return { ok: true, value }
  }
}
