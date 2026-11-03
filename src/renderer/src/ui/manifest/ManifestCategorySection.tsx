import { useState } from 'react'
import type { BuiltInAssetCategory, ManifestModuleData, ManifestModuleId } from '@shared/ipc'
import { renderCategoryIcon } from '../assets/categoryIcons'
import { IconCheck, IconEye, IconEyeOff, IconPlus, IconTrash } from '../icons'

const BUILTIN_ICON_OPTIONS: Array<{ key: string; label: string }> = [
  { key: 'user-male', label: 'Nam' },
  { key: 'user-female', label: 'Nữ' },
  { key: 'paw', label: 'Động vật' },
  { key: 'tree', label: 'Cây cối' },
  { key: 'decor', label: 'Hoa lá' },
  { key: 'home', label: 'Nhà cửa' },
  { key: 'room', label: 'Nội thất' },
  { key: 'prop', label: 'Đạo cụ' },
  { key: 'flame', label: 'Lửa/Khói' },
  { key: 'lightning', label: 'Tia sét' },
  { key: 'sparkles', label: 'Hiệu ứng' },
  { key: 'vehicle', label: 'Xe cộ' },
  { key: 'cube', label: 'Khối 3D' },
  { key: 'music', label: 'Nhạc' },
  { key: 'voice', label: 'Giọng đọc' },
  { key: 'folder', label: 'Thư mục' }
]

interface ManifestCategorySectionProps {
  moduleId: ManifestModuleId
  moduleData: ManifestModuleData
  saving: boolean
  onSaveCategories: (nextCategories: BuiltInAssetCategory[]) => Promise<void>
}

export function ManifestCategorySection({
  moduleId,
  moduleData,
  saving,
  onSaveCategories
}: ManifestCategorySectionProps) {
  const [categories, setCategories] = useState<BuiltInAssetCategory[]>(() => [...(moduleData.categories ?? [])])
  const [newId, setNewId] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newFolder, setNewFolder] = useState('')
  const [dirty, setDirty] = useState(false)

  const handlePatchCategory = (id: string, patch: Partial<BuiltInAssetCategory>): void => {
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
    setDirty(true)
  }

  const handleAddCategory = async (): Promise<void> => {
    const cleanTitle = newTitle.trim() || 'Chủ đề mới'
    const slug =
      (newId.trim() || cleanTitle)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '') || `topic_${Date.now().toString(36)}`
    if (categories.some((c) => c.id === slug)) return

    const nextCat: BuiltInAssetCategory = {
      id: slug,
      title: cleanTitle,
      shortTitle: cleanTitle.slice(0, 14),
      folder: newFolder.trim() || `${moduleId}/${slug}`,
      icon: 'sparkles',
      iconText: cleanTitle.slice(0, 2).toUpperCase(),
      accent: '#38bdf8',
      order: categories.length + 1,
      status: 'active'
    }
    const nextList = [...categories, nextCat]
    setCategories(nextList)
    setNewId('')
    setNewTitle('')
    setNewFolder('')
    setDirty(false)
    await onSaveCategories(nextList)
  }

  const handleDeleteCategory = async (id: string): Promise<void> => {
    const nextList = categories.filter((c) => c.id !== id)
    setCategories(nextList)
    setDirty(false)
    await onSaveCategories(nextList)
  }

  const handleSaveAll = async (): Promise<void> => {
    setDirty(false)
    await onSaveCategories(categories)
  }

  return (
    <div data-mcp-region="manifest_categories" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="manifest-status-banner">
        <div>
          <strong>Chủ đề & Nhóm động ({categories.length})</strong> — Thay đổi tên, thư mục <code>folder</code>,{' '}
          <code>iconUrl</code> (tự động báo icon lỗi nếu mất file) hoặc <code>iconText</code> sẽ cập nhật tức thì trên
          xưởng tương ứng.
        </div>
        {dirty && (
          <button
            type="button"
            className="btn primary sm"
            disabled={saving}
            onClick={() => void handleSaveAll()}
          >
            <IconCheck width={13} height={13} /> Lưu thay đổi chủ đề
          </button>
        )}
      </div>

      {/* Form thêm nhanh chủ đề mới */}
      <div className="manifest-card" style={{ borderStyle: 'dashed' }}>
        <div className="manifest-card-head">
          <div className="manifest-card-title">+ Thêm chủ đề / nhóm mới vào {moduleData.title}</div>
          <button
            id="manifest-add-category-btn"
            type="button"
            className="btn primary sm"
            disabled={saving || !newTitle.trim()}
            onClick={() => void handleAddCategory()}
          >
            <IconPlus width={13} height={13} /> Thêm ngay
          </button>
        </div>
        <div className="manifest-field-grid">
          <div className="manifest-field">
            <label>Tên chủ đề hiển thị (Tiếng Việt)</label>
            <input
              className="manifest-input"
              placeholder="VD: Thác nước & Suối, Vũ khí cổ trang..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
          </div>
          <div className="manifest-field">
            <label>Mã định danh ID (tuỳ chọn, tự tạo nếu để trống)</label>
            <input
              className="manifest-input"
              placeholder="VD: waterfall_fx"
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
            />
          </div>
          <div className="manifest-field full">
            <label>Thư mục lưu trữ trong assets/ (VD: characters, nature/waterfalls...)</label>
            <input
              className="manifest-input"
              placeholder="VD: nature/waterfalls"
              value={newFolder}
              onChange={(e) => setNewFolder(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Lưới Card đa cột hiển thị các chủ đề hiện có */}
      <div className="manifest-card-grid">
        {categories.map((cat) => {
          const isHidden = cat.status === 'hidden' || cat.status === 'deleted'
          return (
            <div
              key={cat.id}
              className={`manifest-card ${isHidden ? 'is-hidden-status' : ''}`}
              style={{ ['--item-c' as string]: cat.accent || 'var(--accent)' }}
            >
              <div className="manifest-card-head">
                <div className="manifest-card-identity">
                  <span
                    className="manifest-card-icon-preview"
                    title="Xem trước Icon (nếu link iconUrl bị xoá/lỗi sẽ hiện biểu tượng cảnh báo)"
                  >
                    {renderCategoryIcon(cat.icon, 16, 16, cat.id, {
                      iconUrl: cat.iconUrl,
                      iconText: cat.iconText
                    })}
                  </span>
                  <div className="manifest-card-title-wrap">
                    <div className="manifest-card-title">{cat.title}</div>
                    <div className="manifest-card-meta">
                      id: {cat.id} {cat.folder ? `· 📁 ${cat.folder}` : ''}
                    </div>
                  </div>
                </div>

                <div className="manifest-card-actions">
                  <button
                    type="button"
                    className="btn ghost icon sm"
                    title={isHidden ? 'Đang tạm ẩn — Bấm để hiển thị lại' : 'Tạm ẩn chủ đề này trên giao diện'}
                    onClick={() =>
                      handlePatchCategory(cat.id, {
                        status: isHidden ? 'active' : 'hidden'
                      })
                    }
                  >
                    {isHidden ? <IconEyeOff width={13} height={13} /> : <IconEye width={13} height={13} />}
                  </button>
                  {cat.id !== 'all' && (
                    <button
                      type="button"
                      className="btn ghost icon sm"
                      title="Xoá chủ đề này khỏi file JSON"
                      onClick={() => void handleDeleteCategory(cat.id)}
                    >
                      <IconTrash width={13} height={13} />
                    </button>
                  )}
                </div>
              </div>

              <div className="manifest-field-grid">
                <div className="manifest-field">
                  <label>Tiêu đề (title)</label>
                  <input
                    className="manifest-input"
                    value={cat.title}
                    onChange={(e) => handlePatchCategory(cat.id, { title: e.target.value })}
                  />
                </div>
                <div className="manifest-field">
                  <label>Nhãn gọn (shortTitle)</label>
                  <input
                    className="manifest-input"
                    value={cat.shortTitle ?? ''}
                    placeholder={cat.title}
                    onChange={(e) => handlePatchCategory(cat.id, { shortTitle: e.target.value })}
                  />
                </div>
                <div className="manifest-field">
                  <label>Thư mục (folder)</label>
                  <input
                    className="manifest-input"
                    value={cat.folder ?? ''}
                    placeholder="VD: characters"
                    onChange={(e) => handlePatchCategory(cat.id, { folder: e.target.value })}
                  />
                </div>
                <div className="manifest-field">
                  <label>Màu nhấn (accent) & Text Icon</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      className="manifest-input"
                      style={{ flex: 1 }}
                      value={cat.accent ?? '#38bdf8'}
                      onChange={(e) => handlePatchCategory(cat.id, { accent: e.target.value })}
                    />
                    <input
                      className="manifest-input"
                      style={{ width: 64 }}
                      placeholder="TXT"
                      title="Chữ viết tắt dạng icon (iconText) khi không dùng SVG"
                      value={cat.iconText ?? ''}
                      onChange={(e) => handlePatchCategory(cat.id, { iconText: e.target.value })}
                    />
                  </div>
                </div>
                <div className="manifest-field full">
                  <label>Link Icon tuỳ chỉnh (iconUrl — tự báo icon lỗi nếu xoá nhầm folder icons/)</label>
                  <input
                    className="manifest-input"
                    placeholder="Để trống dùng SVG có sẵn, hoặc nhập: icons/default-topic.svg"
                    value={cat.iconUrl ?? ''}
                    onChange={(e) =>
                      handlePatchCategory(cat.id, {
                        iconUrl: e.target.value.trim() ? e.target.value : undefined
                      })
                    }
                  />
                </div>
                <div className="manifest-field full">
                  <label>Hoặc chọn nhanh Icon SVG dựng sẵn</label>
                  <div className="manifest-icon-chips">
                    {BUILTIN_ICON_OPTIONS.map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        className={`manifest-icon-chip ${cat.icon === opt.key && !cat.iconUrl ? 'active' : ''}`}
                        onClick={() => handlePatchCategory(cat.id, { icon: opt.key, iconUrl: undefined })}
                      >
                        {renderCategoryIcon(opt.key, 11, 11)}
                        <span>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
