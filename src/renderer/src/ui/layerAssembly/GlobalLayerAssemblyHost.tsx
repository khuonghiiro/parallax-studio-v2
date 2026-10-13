import { useCallback, useEffect, useState } from 'react'
import type { LayerComposite } from './types'
import { LayerAssemblyDialog } from './LayerAssemblyDialog'
import { CreateLayerAssemblyModal } from './CreateLayerAssemblyModal'
import { getStoredComposites } from './layerAssemblyStorage'
import { consumePendingOpenLayerAssembly } from './layerAssemblyBridge'
import { useEditor } from '../../store/editor'
import { useView } from '../../store/view'

/**
 * Top-level Host component rendered in App.tsx to ensure Layer Assembly Workshop
 * can be opened reliably from anywhere (Toolbar, Asset tab, MCP commands)
 * without depending on subtab navigation.
 */
export function GlobalLayerAssemblyHost() {
  const [editingComposite, setEditingComposite] = useState<LayerComposite | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  const dismissOtherModals = useCallback(() => {
    useEditor.getState().setPlaying(false)
    const view = useView.getState()
    if (view.dialog) view.openDialog(null)
    if (view.assemblyModalModel) view.closeAssemblyWorkshop()
  }, [])

  const openWithComposite = useCallback((comp: LayerComposite | null) => {
    dismissOtherModals()
    setEditingComposite(comp)
    setIsDialogOpen(true)
    setIsCreateModalOpen(false)
  }, [dismissOtherModals])

  const openCreateModal = useCallback(() => {
    dismissOtherModals()
    setIsCreateModalOpen(true)
    setIsDialogOpen(false)
    setEditingComposite(null)
  }, [dismissOtherModals])

  const closeAll = useCallback(() => {
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
