/** CSSOM normalizes whitespace and quote style; compare source selectors consistently. */
export const normalizeUiSelector = (selector: string): string => selector.replace(/\s+/g, ' ').trim()
  .replace(/\s*([>,+~])\s*/g, '$1').replace(/\s*=\s*/g, '=').replace(/'/g, '"')

/** Include alternative interaction states, themes and pseudo-elements in a UI styling package. */
export function uiSelectorForMatching(selector: string): string {
  return selector
    .replace(/\[data-theme\s*=\s*["']?(?:light|dark)["']?\s*\]/g, '')
    .replace(/::[\w-]+(?:\([^)]*\))?/g, '')
    .replace(/:not\(\s*:(?:hover|active|focus-visible|focus-within|focus|disabled|enabled|checked)\s*\)/g, '')
    .replace(/\.(?:active|selected|open|disabled|is-active|is-open)(?![\w-])/g, '')
    .replace(/:not\(\s*\)/g, '')
    .replace(/:(?:hover|active|focus-visible|focus-within|focus|visited|link|disabled|enabled|checked|indeterminate)(?![\w-])/g, '')
    .trim()
}
