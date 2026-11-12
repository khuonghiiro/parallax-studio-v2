import { normalizeUiSelector, uiSelectorForMatching } from '@shared/aiCodeSelectors'

/** Read selector metadata, not full stylesheet text, while the selected DOM is still present. */
export function matchedUiSelectors(elements: Element[]): string[] | undefined {
  if (typeof document === 'undefined' || !document.styleSheets) return undefined
  const selectors = new Set<string>()
  let readable = false
  const walk = (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      if ('selectorText' in rule) {
        const selector = String(rule.selectorText)
        const parts = selector.split(',').map((p) => p.trim()).filter(Boolean)
        let anyMatched = false
        for (const part of parts) {
          const match = uiSelectorForMatching(part)
          if (!match) continue
          try {
            if (elements.some((el) => el.matches(match))) {
              anyMatched = true
              selectors.add(normalizeUiSelector(part))
            }
          } catch {
            /* Unsupported selectors do not authorize unrelated rules. */
          }
        }
        if (anyMatched) {
          selectors.add(normalizeUiSelector(selector))
        }
      }
      if ('cssRules' in rule) walk((rule as CSSGroupingRule).cssRules)
    }
  }
  for (const sheet of Array.from(document.styleSheets)) {
    try { walk(sheet.cssRules); readable = true } catch { /* Cross-origin stylesheets cannot be inspected. */ }
  }
  return readable ? [...selectors] : undefined
}
