import React, { useState } from 'react'
import { computeFrontLayerZ, type useLayerWorkshop } from '../useLayerWorkshop'
import type { CutPiece } from './types'
import { computeAutoFitPieceScale } from './cutterHelpers'
import { SpriteCutterSourcePane } from './SpriteCutterSourcePane'
import { SpriteCutterTargetPane } from './SpriteCutterTargetPane'
import { SegmentedTabs, useResponsiveViewport } from '../../primitives'
import { IconImage, IconLayers } from '../../icons'
import '../../../styles/layerAssemblyCutter.css'
import '../../../styles/layerAssemblyCutterToolbar.css'
import '../../../styles/layerAssemblyCutterStudio.css'

export interface LayerAssemblyCutterWorkspaceProps {
  state: ReturnType<typeof useLayerWorkshop>
}

type CutterResponsivePane = 'source' | 'target'

export function LayerAssemblyCutterWorkspace({ state }: LayerAssemblyCutterWorkspaceProps) {
  const [selectedPiece, setSelectedPiece] = useState<CutPiece | null>(null)
  const [activePane, setActivePane] = useState<CutterResponsivePane>('source')
  const { width } = useResponsiveViewport()
  const isCompactCutter = width <= 960

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
    <div className={`layer-cutter-workspace-shell${isCompactCutter ? ' is-compact' : ''}`}>
      {isCompactCutter && (
        <div className="workshop-responsive-bar">
          <SegmentedTabs<CutterResponsivePane>
            variant="segmented"
            size="sm"
            ariaLabel="Chuyển khung Cắt tách Sprite"
            value={activePane}
            onChange={setActivePane}
            items={[
              {
                id: 'source',
                label: 'Ảnh gốc & Tách nền',
                icon: <IconImage width={13} height={13} />
              },
              {
                id: 'target',
                label: 'Khung lắp mẫu',
                icon: <IconLayers width={13} height={13} />,
                badge: state.composite.layers.length
              }
            ]}
          />
        </div>
      )}
      <div className="layer-cutter-split-container" data-mcp-region="layer_assembly_cutter">
        {(!isCompactCutter || activePane === 'source') && (
          <SpriteCutterSourcePane
            selectedPiece={selectedPiece}
            onSelectPiece={setSelectedPiece}
            onTransferToTarget={handleTransferToTarget}
            targetBoardSize={{ width: state.composite.width || 600, height: state.composite.height || 600 }}
          />
        )}
        {(!isCompactCutter || activePane === 'target') && (
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
        )}
      </div>
    </div>
  )
}
