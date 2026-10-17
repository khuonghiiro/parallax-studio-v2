import React, { useState } from 'react'
import { computeFrontLayerZ, type useLayerWorkshop } from '../useLayerWorkshop'
import type { CutPiece } from './types'
import { computeAutoFitPieceScale } from './cutterHelpers'
import { SpriteCutterSourcePane } from './SpriteCutterSourcePane'
import { SpriteCutterTargetPane } from './SpriteCutterTargetPane'
import '../../../styles/layerAssemblyCutter.css'
import '../../../styles/layerAssemblyCutterToolbar.css'
import '../../../styles/layerAssemblyCutterStudio.css'

export interface LayerAssemblyCutterWorkspaceProps {
  state: ReturnType<typeof useLayerWorkshop>
}

export function LayerAssemblyCutterWorkspace({ state }: LayerAssemblyCutterWorkspaceProps) {
  const [selectedPiece, setSelectedPiece] = useState<CutPiece | null>(null)

  const handleTransferToTarget = (piece: CutPiece, pos?: { x: number; y: number }) => {
    const fitScale = computeAutoFitPieceScale(
      piece,
      state.composite.width,
      state.composite.height
    )
    const frontZ = computeFrontLayerZ(state.composite.layers)
    state.add(
      piece.label || 'Mảnh cắt',
      '',
      piece.dataUrl,
      pos || { x: 0, y: 0 },
      frontZ,
      fitScale
    )
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
        targetBoardSize={{ width: state.composite.width || 600, height: state.composite.height || 600 }}
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
