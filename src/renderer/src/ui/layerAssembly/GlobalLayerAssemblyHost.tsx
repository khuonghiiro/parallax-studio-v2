import { useCallback, useEffect, useState } from 'react'
import type { LayerComposite } from './types'
import { LayerAssemblyDialog } from './LayerAssemblyDialog'
import { CreateLayerAssemblyModal } from './CreateLayerAssemblyModal'
import { getStoredComposites } from './layerAssemblyStorage'
import { consumePendingOpenLayerAssembly } from './layerAssemblyBridge'
import {
  clearActiveWorkshopSession,
  loadActiveWorkshopSession,
  saveActiveWorkshopSession,
  type LayerAssemblyActiveSession
} from './layerAssemblySessionStorage'
import { useEditor } from '../../store/editor'
import { useView } from '../../store/view'

/**
 * Top-level Host component rendered in App.tsx to ensure Layer Assembly Workshop
 * can be opened reliably from anywhere (Toolbar, Asset tab, MCP commands)
 * without depending on subtab navigation.
 *
 * Tự động khôi phục phiên làm việc (Session Auto-Restore):
 * Khi Vite hot-reload, tải lại trang (F5) hoặc mở lại xưởng, component tự động
 * nạp lại composite và bản nháp đang chỉnh sửa từ storage, tránh tình trạng
 * xưởng bị đóng đột ngột hay mất các thao tác chưa kịp lưu của người dùng.
 */
export function GlobalLayerAssemblyHost() {
  const [restoredSession] = useState<LayerAssemblyActiveSession | null>(() => loadActiveWorkshopSession())
  const [editingComposite, setEditingComposite] = useState<LayerComposite | null>(() => {
    if (restoredSession?.isOpen && restoredSession.draftComposite) {
      return restoredSession.draftComposite
    }
    return null
  })
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(() => {
    return Boolean(restoredSession?.isOpen && restoredSession.draftComposite)
  })
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  const dismissOtherModals = useCallback(() => {
    useEditor.getState().setPlaying(false)
    const view = useView.getState()
    if (view.dialog) view.openDialog(null)
    if (view.assemblyModalModel) view.closeAssemblyWorkshop()
  }, [])

  const openWithComposite = useCallback(
    (comp: LayerComposite | null) => {
      dismissOtherModals()
      setEditingComposite(comp)
      setIsDialogOpen(true)
      setIsCreateModalOpen(false)
      if (comp) {
        saveActiveWorkshopSession({
          isOpen: true,
          compositeId: comp.id,
          draftComposite: comp,
          timestamp: Date.now()
        })
      }
    },
    [dismissOtherModals]
  )

  const openCreateModal = useCallback(() => {
    // Tạm thời bỏ qua dialog trung gian Tạo lắp ráp mới, vào thẳng xưởng LayerAssemblyDialog
    openWithComposite(null)
  }, [openWithComposite])

  const closeAll = useCallback(() => {
    clearActiveWorkshopSession()
    setIsDialogOpen(false)
    setIsCreateModalOpen(false)
    setEditingComposite(null)
  }, [])

  useEffect(() => {
    const pending = consumePendingOpenLayerAssembly()
    if (pending) {
      if (pending.composite) {
        openWithComposite(pending.composite)
      } else if (pending.compositeId) {
        const found = getStoredComposites().find((c) => c.id === pending.compositeId)
        openWithComposite(found || null)
      } else {
        openCreateModal()
      }
    }

    const handleOpenReq = (e: Event) => {
      const customEvent = e as CustomEvent<{ compositeId?: string; composite?: LayerComposite }>
      const direct = customEvent.detail?.composite
      const targetId = customEvent.detail?.compositeId
      if (direct) {
        openWithComposite(direct)
      } else if (targetId) {
        const found = getStoredComposites().find((c) => c.id === targetId)
        openWithComposite(found || null)
      } else {
        openCreateModal()
      }
    }

    const handleCloseReq = () => {
      closeAll()
    }

    window.addEventListener('layerAssembly:open', handleOpenReq)
    window.addEventListener('layerAssembly:close', handleCloseReq)
    return () => {
      window.removeEventListener('layerAssembly:open', handleOpenReq)
      window.removeEventListener('layerAssembly:close', handleCloseReq)
    }
  }, [openWithComposite, openCreateModal, closeAll])

  return (
    <>
      {isDialogOpen && (
        <LayerAssemblyDialog
          key={editingComposite?.id || 'new'}
          initialComposite={editingComposite}
          initialTab={restoredSession?.tab}
          initialPrimaryMode={restoredSession?.primaryMode}
          initialBoneId={restoredSession?.selectedBoneId}
          onClose={closeAll}
        />
      )}

      <CreateLayerAssemblyModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSelectTemplate={(comp) => {
          openWithComposite(comp)
        }}
        onSelectBlank={() => {
          openWithComposite(null)
        }}
      />
    </>
  )
}
