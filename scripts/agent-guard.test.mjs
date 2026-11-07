import { describe, expect, it } from 'vitest'
import { checkCodeSyntax, checkCommitMessage, checkStagedFile } from './agent-guard.mjs'

describe('agent-guard commit-msg', () => {
  it('accepts Vietnamese commit format [loại] (scope): mô tả with diacritics', () => {
    expect(checkCommitMessage('[sửa lỗi] (layer): sửa lỗi vị trí @import trong photoStudio.css\n')).toEqual([])
    expect(checkCommitMessage('[tính năng] (ui): thêm thanh công cụ rail photoshop')).toEqual([])
    expect(checkCommitMessage('[chỉnh sửa] (timeline): điều chỉnh thanh trượt 60fps')).toEqual([])
    expect(checkCommitMessage('[xoá] (assets): loại bỏ file rác không dùng')).toEqual([])
    expect(checkCommitMessage('[tái cấu trúc] (engine): tách module SceneRenderer')).toEqual([])
    expect(checkCommitMessage('[hiệu năng] (viewer): tối ưu bộ nhớ texture LRU pool')).toEqual([])
    expect(checkCommitMessage('[dọn dẹp]: cập nhật gitignore và dọn dẹp cache')).toEqual([])
    expect(checkCommitMessage('fix(ui): sửa lỗi combobox bị đơ 2 giây\n')).toEqual([])
    expect(checkCommitMessage('feat: thêm script dọn manifest.json')).toEqual([])
  })

  it('lets Vietnamese merge commits through', () => {
    expect(checkCommitMessage("[hợp nhất] nhánh 'sua/photo-studio' vào main")).toEqual([])
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
    const fakeKey = `export const k = "${['-----BEGIN', 'PRIVATE KEY-----'].join(' ')}"\n`
    expect(checkStagedFile('src/k.ts', fakeKey)).toHaveLength(1)
  })

  it('blocks broken JS/TS/JSX/TSX syntax such as unparenthesized ?? with &&', () => {
    const brokenTsx = 'export const x = a ?? b && c ?? d\n'
    expect(checkCodeSyntax('src/Broken.tsx', brokenTsx)).toHaveLength(1)
    expect(checkStagedFile('src/Broken.tsx', brokenTsx)).toHaveLength(1)

    const validTsx = 'export const x = a ?? (b ? c : undefined) ?? d\n'
    expect(checkCodeSyntax('src/Valid.tsx', validTsx)).toEqual([])
    expect(checkStagedFile('src/Valid.tsx', validTsx)).toEqual([])
  })
})
