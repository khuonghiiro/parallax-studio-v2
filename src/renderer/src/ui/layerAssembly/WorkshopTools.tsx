import { useState } from 'react'
import type { WorkshopAction } from './workshopActions'

export function WorkshopTools({ count, total, canUndo, canRedo, undo, redo, selectAll, clear, run }: {
  count: number; total: number; canUndo: boolean; canRedo: boolean
  undo: () => void; redo: () => void; selectAll: () => void; clear: () => void
  run: (action: WorkshopAction, spacing?: number) => void
}) {
  const [spacing, setSpacing] = useState(80)
  return <div className="lw-tools" aria-label="Công cụ lắp ráp">
    <div className="lw-tool-group">
      <button className="btn sm" disabled={!canUndo} onClick={undo} title="Hoàn tác (Ctrl+Z)">↶ Hoàn tác</button>
      <button className="btn sm" disabled={!canRedo} onClick={redo} title="Làm lại (Ctrl+Shift+Z)">↷</button>
    </div>
    <div className="lw-tool-group">
      <button className="btn sm" disabled={!total} onClick={selectAll}>Chọn tất cả</button>
      <button className="btn sm" disabled={!count} onClick={clear}>{count} đã chọn ×</button>
    </div>
    <div className="lw-tool-group">
      <button className="btn sm" disabled={!count} onClick={() => run('center-x')} title="Căn tâm ngang của các lớp đã chọn về X = 0">Tâm X</button>
      <button className="btn sm" disabled={!count} onClick={() => run('center-y')} title="Căn tâm dọc của các lớp đã chọn về Y = 0">Tâm Y</button>
      <button className="btn sm" disabled={count < 3} onClick={() => run('distribute-x')} title="Chia đều tâm các lớp giữa hai đầu theo X">Đều X</button>
      <button className="btn sm" disabled={count < 3} onClick={() => run('distribute-y')} title="Chia đều tâm các lớp giữa hai đầu theo Y">Đều Y</button>
    </div>
    <div className="lw-tool-group">
      <label>Bước Z <input type="number" min={1} max={2000} value={spacing} onChange={(e) => setSpacing(Math.max(1, Math.min(2000, Number(e.target.value) || 1)))} /> px</label>
      <button className="btn sm" disabled={count < 2} onClick={() => run('depth-forward', spacing)} title="Theo thứ tự danh sách: nền Z dương → trước Z âm">Tách lớp</button>
      <button className="btn sm" disabled={count < 2} onClick={() => run('depth-reverse', spacing)} title="Đảo chiều phân bố Z">Đảo Z</button>
    </div>
    <select aria-label="Thao tác với các lớp đã chọn" className="input-text sm" disabled={!count} value="" onChange={(e) => run(e.target.value as WorkshopAction)}>
      <option value="" disabled>Thao tác…</option>
      <option value="duplicate">Nhân bản (Ctrl+D)</option><option value="delete">Xóa (Delete)</option>
      <option value="lock">Khóa</option><option value="unlock">Mở khóa</option>
      <option value="hide">Ẩn</option><option value="show">Hiện</option>
      <option value="flatten">Gom về Z = 0</option><option value="reset-transform">Đặt lại biến đổi</option>
      <option value="stagger">Hoạt ảnh so le pha</option><option value="stop-motion">Tắt hoạt ảnh</option>
    </select>
  </div>
}
