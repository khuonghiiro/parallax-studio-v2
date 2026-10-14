import React, { useState } from 'react'
import type { useLayerWorkshop } from '../useLayerWorkshop'
import type { CutPiece } from './types'
import { SpriteCutterSourcePane } from './SpriteCutterSourcePane'
import { SpriteCutterTargetPane } from './SpriteCutterTargetPane'
import '../../../styles/layerAssemblyCutter.css'
import '../../../styles/layerAssemblyCutterToolbar.css'

export interface LayerAssemblyCutterWorkspaceProps {
  state: ReturnType<typeof useLayerWorkshop>
}

export function LayerAssemblyCutterWorkspace({ state }: LayerAssemblyCutterWorkspaceProps) {
  const [selectedPiece, setSelectedPiece] = useState<CutPiece | null>(null)

  const handleTransferToTarget = (piece: CutPiece) => {
    state.add(piece.label || 'Mảnh cắt', '', piece.dataUrl, { x: 0, y: 0 })
  }

  const handleClearAllLayers = () => {
    state.run('delete', undefined, state.composite.layers.map((l) => l.id))
  }

  return (
    <div className="layer-cutter-split-container">
      <SpriteCutterSourcePane
        selectedPiece={selectedPiece}
        onSelectPiece={setSelectedPiece}
        onTransferToTarget={handleTransferToTarget}
      />
      <SpriteCutterTargetPane
        composite={state.composite}
        selectedLayerId={state.selectedLayerId}
        selectedPiece={selectedPiece}
        onSelectLayer={state.select}
        onAddLayer={state.add}
        onUpdateLayer={state.update}
        onDeleteLayer={(id) => state.run('delete', undefined, [id])}
        onClearAllLayers={handleClearAllLayers}
      />
    </div>
  )
}
