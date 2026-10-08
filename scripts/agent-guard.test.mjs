import { describe, expect, it } from 'vitest'
import { checkCommitMessage, checkStagedFile } from './agent-guard.mjs'

describe('agent-guard commit-msg', () => {
  it('accepts Vietnamese conventional commits with diacritics', () => {
    expect(checkCommitMessage('fix(ui): sửa lỗi combobox bị đơ 2 giây\n')).toEqual([])
    expect(checkCommitMessage('feat: thêm script dọn manifest.json')).toEqual([])
  })

  it('rejects messages without diacritics or conventional prefix', () => {
    expect(checkCommitMessage('fix: sua loi combobox')).toHaveLength(1)
    expect(checkCommitMessage('sửa lỗi combobox')).toHaveLength(1)
    expect(checkCommitMessage('update stuff')).toHaveLength(2)
  })

  it('rejects AI watermarks and ignores comment lines', () => {
    const msg = 'feat: thêm tính năng\n\nCo-Authored-By: Claude <noreply@anthropic.com>'
    expect(checkCommitMessage(msg).some((e) => e.includes('AI'))).toBe(true)
    expect(checkCommitMessage('chore: dọn dẹp\n# Generated with Claude')).toEqual([])
  })

  it('lets merge commits through', () => {
    expect(checkCommitMessage("Merge branch 'main' into Edit_Asset_3D")).toEqual([])
  })
})

describe('agent-guard pre-commit', () => {
  it('enforces the 1000-line hard limit for code files only', () => {
    const big = 'x\n'.repeat(1001)
    expect(checkStagedFile('src/a.ts', big)).toHaveLength(1)
    expect(checkStagedFile('src/a.ts', 'x\n'.repeat(1000))).toEqual([])
    expect(checkStagedFile('docs/a.md', big)).toEqual([])
  })

  it('blocks secret files and private keys', () => {
    expect(checkStagedFile('.env', 'A=1')).toHaveLength(1)
    const fakeKey = ['-----BEGIN', 'PRIVATE KEY-----'].join(' ')
    expect(checkStagedFile('src/k.ts', fakeKey)).toHaveLength(1)
  })
})
