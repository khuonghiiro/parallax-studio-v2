import { useMemo, useState } from 'react'
import type { BuiltInAssetCategory, BuiltInAssetItem, ManifestAssetMeta } from '@shared/ipc'
import { renderCategoryIcon } from '../assets/categoryIcons'
import { IconCheck, IconFolder, IconRefresh, IconTrash } from '../icons'

interface ManifestAssetSectionProps {
  mode: 'active' | 'trash'
  categories: BuiltInAssetCategory[]
  items: BuiltInAssetItem[]
  deletedItems: BuiltInAssetItem[]
  saving: boolean
  onSaveAssetMeta: (relPath: string, meta: Partial<ManifestAssetMeta>) => Promise<void>
  onSoftDelete: (relativePath: string) => Promise<void>
  onPermanentDelete: (relativePath: string) => Promise<void>
  onRestore: (relativePath: string) => Promise<void>
  onPrune: () => Promise<void>
}

export function ManifestAssetSection({
  mode,
  categories,
  items,
  deletedItems,
  saving,
  onSaveAssetMeta,
  onSoftDelete,
  onPermanentDelete,
  onRestore,
  onPrune
}: ManifestAssetSectionProps) {
  const [search, setSearch] = useState('')
  const [selectedCat, setSelectedCat] = useState<string>('all')
  const [draftNames, setDraftNames] = useState<Record<string, string>>({})

  const sourceList = mode === 'trash' ? deletedItems : items
  const selectableCategories = useMemo(
    () => categories.filter((c) => c.id !== 'all' && c.status !== 'deleted'),
    [categories]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return sourceList.filter((item) => {
      const cat = item.category || item.folder || ''
      if (selectedCat !== 'all' && cat !== selectedCat) return false
      if (!q) return true
      return (
        item.name.toLowerCase().includes(q) ||
        item.relativePath.toLowerCase().includes(q) ||
        cat.toLowerCase().includes(q)
      )
    })
  }, [sourceList, selectedCat, search])

  return (
    <div
      data-mcp-region={mode === 'trash' ? 'manifest_trash' : 'manifest_assets'}
      style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <div className="manifest-status-banner">
        <div>
          {mode === 'trash' ? (
            <>
              <strong>Kho tạm đã xoá (assets/_temp_deleted · {deletedItems.length} tệp)</strong> — Các tài nguyên xoá
              tạm nằm trong thư mục <code>assets/_temp_deleted/</code> với trạng thái{' '}
              <code>&quot;status&quot;: &quot;deleted&quot;</code>. Bạn có thể khôi phục lại nguyên trạng hoặc xoá hẳn
              rồi chạy <code>assets/prune-manifest.bat</code>.
            </>
          ) : (
            <>
              <strong>Danh sách Tài nguyên ({filtered.length}/{items.length})</strong> — Đổi tên hiển thị tiếng Việt,
              chuyển chủ đề 1-click hoặc xoá tạm vào <code>assets/_temp_deleted/</code> để phòng khi cần khôi phục.
            </>
          )}
        </div>
        <button
          id="manifest-prune-btn"
          type="button"
          className="btn ghost sm"
          disabled={saving}
          onClick={() => void onPrune()}
          title="Dò toàn bộ thư mục assets/ và _temp_deleted/ để tự động làm sạch manifest.json (tương đương chạy prune-manifest.bat)"
        >
          <IconRefresh width={13} height={13} /> Dò & Làm sạch JSON (Prune)
        </button>
      </div>

      {/* Bộ lọc tìm kiếm + chọn nhóm */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <input
          className="manifest-input"
          style={{ maxWidth: 320 }}
          placeholder="Tìm theo tên tài nguyên hoặc đường dẫn file..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="manifest-category-pills">
          <button
            type="button"
            className={`manifest-category-pill ${selectedCat === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedCat('all')}
          >
            Tất cả ({sourceList.length})
          </button>
          {selectableCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`manifest-category-pill ${selectedCat === cat.id ? 'active' : ''}`}
              style={{ ['--item-c' as string]: cat.accent || 'var(--accent)' }}
              onClick={() => setSelectedCat(cat.id)}
            >
              {renderCategoryIcon(cat.icon, 11, 11, cat.id, {
                iconUrl: cat.iconUrl,
                iconText: cat.iconText
              })}
              <span>{cat.shortTitle || cat.title}</span>
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="manifest-card" style={{ alignItems: 'center', padding: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
            {mode === 'trash'
              ? 'Kho tạm _temp_deleted hiện đang trống'
              : 'Không có tài nguyên nào khớp bộ lọc hiện tại'}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>
            {mode === 'trash'
              ? 'Khi bạn bấm xoá tạm một tài nguyên ở kho công cộng hoặc tại đây, file sẽ được cất vào assets/_temp_deleted/ để khôi phục bất kỳ lúc nào.'
              : 'Hãy thử chọn chủ đề "Tất cả" hoặc xoá từ khoá tìm kiếm.'}
          </div>
        </div>
      ) : (
        <div className="manifest-card-grid">
          {filtered.map((item) => {
            const draftName = draftNames[item.relativePath] ?? item.name
            const nameChanged = draftName.trim() !== '' && draftName.trim() !== item.name
            const itemCat = item.category || item.folder || ''

            return (
              <div
                key={item.relativePath}
                className={`manifest-card ${mode === 'trash' ? 'is-deleted-status' : ''}`}
              >
                <div className="manifest-card-head">
                  <div className="manifest-card-identity">
                    {item.kind === 'image' && item.previewUrl ? (
                      <img
                        src={item.previewUrl}
                        alt={item.name}
                        className="manifest-asset-thumb"
                        loading="lazy"
                      />
                    ) : (
                      <span className="manifest-card-icon-preview">
                        <IconFolder width={16} height={16} />
                      </span>
                    )}
                    <div className="manifest-card-title-wrap">
                      <div className="manifest-card-title" title={item.name}>
                        {item.name}
                      </div>
                      <div className="manifest-card-meta" title={item.relativePath}>
                        {item.relativePath}
                      </div>
                      {item.tempPath && (
                        <div className="manifest-card-meta" style={{ color: 'var(--key)' }}>
                          Kho tạm: {item.tempPath}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="manifest-card-actions">
                    {mode === 'trash' ? (
                      <>
                        <button
                          type="button"
                          className="btn primary sm"
                          disabled={saving}
                          onClick={() => void onRestore(item.relativePath)}
                          title="Khôi phục tệp từ assets/_temp_deleted/ về đúng vị trí cũ"
                        >
                          <IconRefresh width={12} height={12} /> Khôi phục
                        </button>
                        <button
                          type="button"
                          className="btn ghost icon sm"
                          disabled={saving}
                          onClick={() => void onPermanentDelete(item.relativePath)}
                          title="Xoá vĩnh viễn tệp này khỏi ổ đĩa và xoá khỏi manifest.json"
                        >
                          <IconTrash width={13} height={13} />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn ghost sm"
                        disabled={saving}
                        onClick={() => void onSoftDelete(item.relativePath)}
                        title="Xoá tạm — Chuyển file sang thư mục assets/_temp_deleted/ để có thể khôi phục lại nếu xoá nhầm"
                      >
                        <IconTrash width={12} height={12} /> Xoá tạm
                      </button>
                    )}
                  </div>
                </div>

                {mode === 'active' && (
                  <>
                    <div className="manifest-field">
                      <label>Tên hiển thị tiếng Việt</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          className="manifest-input"
                          value={draftName}
                          onChange={(e) =>
                            setDraftNames((prev) => ({
                              ...prev,
                              [item.relativePath]: e.target.value
                            }))
                          }
                        />
                        {nameChanged && (
                          <button
                            type="button"
                            className="btn primary sm"
                            disabled={saving}
                            onClick={() =>
                              void onSaveAssetMeta(item.relativePath, {
                                name: draftName.trim(),
                                category: itemCat || undefined
                              })
                            }
                          >
                            <IconCheck width={12} height={12} /> Lưu
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="manifest-field">
                      <label>Chủ đề phân loại (1-Click đổi nhóm)</label>
                      <div className="manifest-category-pills">
                        {selectableCategories.map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            className={`manifest-category-pill ${itemCat === cat.id ? 'active' : ''}`}
                            style={{ ['--item-c' as string]: cat.accent || 'var(--accent)' }}
                            onClick={() => {
                              if (itemCat !== cat.id) {
                                void onSaveAssetMeta(item.relativePath, {
                                  name: item.name,
                                  category: cat.id
                                })
                              }
                            }}
                          >
                            {renderCategoryIcon(cat.icon, 10, 10, cat.id, {
                              iconUrl: cat.iconUrl,
                              iconText: cat.iconText
                            })}
                            <span>{cat.shortTitle || cat.title}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
