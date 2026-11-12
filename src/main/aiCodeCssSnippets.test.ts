import { expect, it } from 'vitest'
import { cssSnippets } from './aiCodeCssSnippets'
import { normalizeUiSelector, uiSelectorForMatching } from '../shared/aiCodeSelectors'

it('excludes same-class CSS from unrelated ancestors using the DOM selector allowlist', () => {
  const css = '.toolbar .btn:hover { color: blue }\n.workshop .btn { color: red }'
  const snippets = cssSnippets(css, ['btn'], new Set([normalizeUiSelector('.toolbar .btn:hover')]))
  expect(snippets).toHaveLength(1)
  expect(snippets[0].content).not.toContain('workshop')
})

it('matches comma-separated selectors when only one branch is in the DOM allowlist', () => {
  const css = '.route-wp-card:hover .wp-card-inline-btns,\n.route-wp-card.active .wp-card-inline-btns {\n  opacity: 1;\n}'
  const snippets = cssSnippets(css, ['wp-card-inline-btns'], new Set([normalizeUiSelector('.route-wp-card:hover .wp-card-inline-btns')]))
  expect(snippets).toHaveLength(1)
  expect(snippets[0].content).toContain('opacity: 1')
})

it('matches alternate theme, interaction states and pseudo-elements without invalid :not()', () => {
  expect(uiSelectorForMatching('[data-theme="light"] .btn:not(:disabled):hover::before')).toBe('.btn')
  expect(uiSelectorForMatching('.btn.active')).toBe('.btn')
  expect(normalizeUiSelector("[data-theme='light'] .btn")).toBe('[data-theme="light"] .btn')
  expect(normalizeUiSelector('.a .b')).not.toBe(normalizeUiSelector('.a.b'))
})

it('keeps matching hover and theme rules inside media conditions, excludes other selectors', () => {
  const css = '.other { color: red }\n@media (max-width: 768px) {\n[data-theme="light"] .target:hover { content: "}"; color: blue; }\n.other { color: pink; }\n}'
  const snippets = cssSnippets(css, ['target'])
  expect(snippets).toHaveLength(1)
  expect(snippets[0].context).toBe('@media (max-width: 768px)')
  expect(snippets[0].content).toContain('.target:hover')
  expect(snippets[0].content).not.toContain('.other')
  expect(css.slice(snippets[0].start, snippets[0].end)).toBe(snippets[0].content)
})

it('does not match class name prefixes or braces inside comments', () => {
  const css = '/* { } */ .target-long { color: red }\n.target { /* } */ color: blue }'
  const snippets = cssSnippets(css, ['target'])
  expect(snippets).toHaveLength(1)
  expect(snippets[0].content).toContain('color: blue')
  expect(snippets[0].startLine).toBe(2)
})

it('supports nested supports/layer groups without losing the original wrappers during replacement', () => {
  const css = '@layer ui { @supports (display: grid) { .target { display: grid } } }'
  const snippet = cssSnippets(css, ['target'])[0]
  expect(snippet.context).toBe('@layer ui → @supports (display: grid)')
  expect(css.slice(0, snippet.start) + '.target { display: flex }' + css.slice(snippet.end))
    .toBe('@layer ui { @supports (display: grid) { .target { display: flex } } }')
})
