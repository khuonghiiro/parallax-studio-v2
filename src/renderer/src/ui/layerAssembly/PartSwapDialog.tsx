import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { AssetTable } from './types'
import type { PartAssetCandidate } from './workshopParts'
import { PartThumb } from './PartThumb'
import { IconFaceSwap, IconSearch, IconUpload, IconX } from '../icons'

export type PartSwapMode = 'replace' | 'variant' | 'activate'

export interface PartSwapVariant extends PartAssetCandidate {
  key: string
  active?: boolean
}

export interface PartSwapDialogProps {
  scope: 'workshop' | 'scene'
  partName: string
  current: { path?: string; previewUrl?: string; assets?: AssetTable }
  info: Array<[string, string]>
  variants: PartSwapVariant[]
  related: PartAssetCandidate[]
  all: PartAssetCandidate[]
  allowVariantMode?: boolean
  initialMode?: 'replace' | 'variant'
  uploadFolder?: string
  onPick: (cand: PartAssetCandidate, mode: PartSwapMode, variantKey?: string) => void | Promise<void>
  onClose: () => void
}

type Tab = 'variants' | 'related' | 'all'

/** Tải ảnh từ máy vào cùng thư mục với bộ phận hiện tại để luôn xuất hiện trong nhóm "Liên quan". */
async function uploadFiles(files: FileList, folder: string): Promise<PartAssetCandidate[]> {
  const out: PartAssetCandidate[] = []
  for (const file of Array.from(files)) {
    const buffer = new Uint8Array(await file.arrayBuffer())
    const res = await window.api?.importBuiltInAssetFile?.({ name: file.name, buffer, folder })
    if (res?.ok && res.relPath) out.push({ path: res.relPath, name: file.name.replace(/\.[^.]+$/, ''), previewUrl: res.item?.previewUrl })
  }
  if (out.length) window.dispatchEvent(new Event('publicAssets:changed'))
  return out
}

function SwapGrid({ items, onPick }: { items: Array<PartAssetCandidate & { key?: string; active?: boolean }>; onPick: (c: PartAssetCandidate & { key?: string }) => void }) {
  if (!items.length) return <div className="lw-empty">Không có ảnh phù hợp. Hãy thử tab khác hoặc tải ảnh lên.</div>
  return (
    <>
      {items.map((c) => (
        <button key={c.key ?? c.path} type="button" className={`lw-swap-item${c.active ? ' active' : ''}`} onClick={() => onPick(c)} title={c.path}>
          <PartThumb path={c.path} previewUrl={c.previewUrl} />
          <span className="lw-swap-item-name">{c.active ? `● ${c.name}` : c.name}</span>
          <span className="lw-swap-item-path">{c.path.startsWith('data:') ? 'Ảnh nhúng' : c.path}</span>
        </button>
      ))}
    </>
  )
}

function ModeOption({ active, title, desc, onClick }: { active: boolean; title: string; desc: string; onClick: () => void }) {
  return (
    <button type="button" className={`lw-mode-option${active ? ' active' : ''}`} onClick={onClick} aria-pressed={active}>
      <span className="lw-mode-radio" />
      <span>
        <strong>{title}</strong>
        <small>{desc}</small>
      </span>
    </button>
  )
}

function SwapSide({ current, info, showModes, mode, setMode }: {
  current: PartSwapDialogProps['current']; info: PartSwapDialogProps['info']; showModes: boolean
  mode: 'replace' | 'variant'; setMode: (m: 'replace' | 'variant') => void
}) {
  return (
    <aside className="lw-swap-side">
      <div className="lw-swap-preview">
        <PartThumb path={current.path} previewUrl={current.previewUrl} assets={current.assets} size="lg" />
      </div>
      <div className="lw-swap-info">
        {info.map(([k, v]) => (
          <SwapInfoRow key={k} label={k} value={v} />
        ))}
      </div>
      {showModes && (
        <div className="lw-mode-group">
          <ModeOption active={mode === 'replace'} onClick={() => setMode('replace')} title="Thay ảnh tại chỗ" desc="Giữ nguyên vị trí, độ sâu Z, xương & nhóm — chỉ đổi hình." />
          <ModeOption active={mode === 'variant'} onClick={() => setMode('variant')} title="Thêm làm biến thể mới" desc="Giữ ảnh cũ thành biến thể ẩn cùng khe, đổi qua lại bằng 1 cú bấm." />
        </div>
      )}
    </aside>
  )
}

function PartSwapBody(props: PartSwapDialogProps) {
  const { partName, current, info, variants, related, all, allowVariantMode, uploadFolder, onPick, onClose } = props
  const [tab, setTab] = useState<Tab>(variants.length > 1 && props.initialMode !== 'variant' ? 'variants' : related.length ? 'related' : 'all')
  const [mode, setMode] = useState<'replace' | 'variant'>(props.initialMode ?? 'replace')
  const [query, setQuery] = useState('')
  const [uploaded, setUploaded] = useState<PartAssetCandidate[]>([])
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const source = tab === 'variants' ? variants : tab === 'related' ? [...uploaded, ...related] : [...uploaded, ...all]
  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? source.filter((c) => `${c.name} ${c.path}`.toLowerCase().includes(q)) : source
  }, [source, query])
  const pick = async (c: PartAssetCandidate & { key?: string }) => {
    setBusy(true)
    try {
      await onPick(c, tab === 'variants' ? 'activate' : mode, c.key)
      onClose()
    } finally {
      setBusy(false)
    }
  }
  const onUpload = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    try {
      const list = await uploadFiles(files, uploadFolder || 'uploads')
      setUploaded((prev) => [...list, ...prev])
      setTab('related')
    } finally {
      setBusy(false)
    }
  }
  const tabs: Array<[Tab, string, number]> = [
    ['variants', 'Biến thể cùng khe', variants.length],
    ['related', 'Liên quan (cùng thư mục)', related.length + uploaded.length],
    ['all', 'Tất cả tài nguyên', all.length + uploaded.length]
  ]
  return (
    <>
      <header className="lw-swap-header">
        <IconFaceSwap width={18} height={18} />
        <h2>
          Thay thế bộ phận <small>{partName}</small>
        </h2>
        <button type="button" className="lw-icon-btn" onClick={onClose} aria-label="Đóng hộp thoại thay thế" title="Đóng (Esc)">
          <IconX width={16} height={16} />
        </button>
      </header>
      <div className="lw-swap-body">
        <SwapSide current={current} info={info} showModes={Boolean(allowVariantMode) && tab !== 'variants'} mode={mode} setMode={setMode} />
        <section className="lw-swap-main">
          <div className="lw-swap-toolbar">
            <div className="lw-chip-row" role="tablist" aria-label="Nguồn ảnh thay thế">
              {tabs.filter(([id, , n]) => id !== 'variants' || n > 0).map(([id, label, n]) => (
                <button key={id} type="button" role="tab" aria-selected={tab === id} className={`lw-chip${tab === id ? ' active' : ''}`} onClick={() => setTab(id)}>
                  {label} <span className="lw-count">{n}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="lw-swap-toolbar">
            <IconSearch width={14} height={14} />
            <input className="lw-input" placeholder="Tìm theo tên hoặc đường dẫn…" value={query} onChange={(e) => setQuery(e.target.value)} />
            <button type="button" className="lw-btn" disabled={busy} onClick={() => fileRef.current?.click()} title={`Tải ảnh vào thư mục ${uploadFolder || 'uploads'}`}>
              <IconUpload width={13} height={13} /> Tải ảnh lên
            </button>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden onChange={(e) => void onUpload(e.target.files)} />
          </div>
          <div className="lw-swap-grid" aria-busy={busy}>
            <SwapGrid items={items} onPick={(c) => void pick(c)} />
          </div>
        </section>
      </div>
      <footer className="lw-swap-footer">
        <span>Mẹo: đặt ảnh biểu cảm cùng thư mục và đặt tên theo dạng <b>face-cry.png</b>, <b>face-angry.png</b> để được gợi ý đầu tiên.</span>
        <button type="button" className="lw-btn" onClick={onClose}>Đóng</button>
      </footer>
    </>
  )
}

function SwapInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span>{label}</span>
      <b title={value}>{value}</b>
    </>
  )
}

/** Chặn Esc lan ra Xưởng (Esc của Xưởng sẽ đóng cả Xưởng). */
function useEscapeClose(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopImmediatePropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])
}

export function PartSwapDialog(props: PartSwapDialogProps) {
  useEscapeClose(props.onClose)
  const body: ReactNode = <PartSwapBody {...props} />
  const label = `Thay thế bộ phận ${props.partName}`
  return createPortal(
    <div className="lw-swap-backdrop" onPointerDown={(e) => e.target === e.currentTarget && props.onClose()}>
      {props.scope === 'scene' ? (
        <div className="lw-swap-modal composite-swap-modal" data-mcp-region="composite_swap" data-mcp-dialog role="dialog" aria-modal="true" aria-label={label}>
          {body}
        </div>
      ) : (
        <div className="lw-swap-modal" data-mcp-region="layer_assembly_swap" data-mcp-dialog role="dialog" aria-modal="true" aria-label={label}>
          {body}
        </div>
      )}
    </div>,
    document.body
  )
}
