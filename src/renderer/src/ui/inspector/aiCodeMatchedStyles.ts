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
        const match = uiSelectorForMatching(selector)
        if (!match) continue
        try {
          if (elements.some((el) => el.matches(match))) selectors.add(normalizeUiSelector(selector))
        } catch { /* Unsupported selectors do not authorize unrelated rules. */ }
      }
      if ('cssRules' in rule) walk((rule as CSSGroupingRule).cssRules)
    }
  }
  for (const sheet of Array.from(document.styleSheets)) {
    try { walk(sheet.cssRules); readable = true } catch { /* Cross-origin stylesheets cannot be inspected. */ }
  }
  return readable ? [...selectors] : undefined
}
