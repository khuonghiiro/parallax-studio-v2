/**
 * Scene colours of the Assembly viewport, resolved from the app's CSS design tokens so
 * the 3D canvas follows the Dark / Light theme like the rest of the UI.
 */
export interface AssemblySceneTheme {
  isLight: boolean
  background: string
  gridMajor: string
  gridMinor: string
  wire: string
  wireSelected: string
  outline: string
  fallbackFace: string
}

export const DEFAULT_SCENE_THEME: AssemblySceneTheme = {
  isLight: false,
  background: '#141414',
  gridMajor: '#666666',
  gridMinor: '#303030',
  wire: '#9e9e9e',
  wireSelected: '#38bdf8',
  outline: '#2680eb',
  fallbackFace: '#9e9e9e'
}

function token(style: CSSStyleDeclaration, name: string, fallback: string): string {
  return style.getPropertyValue(name).trim() || fallback
}

/** Reads the theme tokens visible at `el` (inherits the closest `[data-theme]`). */
export function readAssemblySceneTheme(el: Element | null, theme: 'dark' | 'light'): AssemblySceneTheme {
  if (!el || typeof getComputedStyle !== 'function') return { ...DEFAULT_SCENE_THEME, isLight: theme === 'light' }
  const s = getComputedStyle(el)
  const d = DEFAULT_SCENE_THEME
  return {
    isLight: theme === 'light',
    background: token(s, '--viewer-surround', token(s, '--bg-0', d.background)),
    gridMajor: token(s, '--text-faint', d.gridMajor),
    gridMinor: token(s, '--line', d.gridMinor),
    wire: token(s, '--text-faint', d.wire),
    wireSelected: token(s, '--accent-cyan', d.wireSelected),
    outline: token(s, '--accent', d.outline),
    fallbackFace: token(s, '--text-dim', d.fallbackFace)
  }
}
