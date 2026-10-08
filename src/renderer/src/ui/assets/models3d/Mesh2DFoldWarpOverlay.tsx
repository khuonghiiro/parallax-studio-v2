import type { Face3D, OrigamiFoldLine } from './types'

interface Mesh2DFoldWarpOverlayProps {
  face: Face3D
  imgW: number
  imgH: number
  onUpdateFace: (faceId: string, updates: Partial<Face3D>) => void
  activeTab?: string
  tool?: string
}

export function Mesh2DFoldWarpOverlay({
  face,
  imgW,
  imgH,
  onUpdateFace,
  activeTab,
  tool
}: Mesh2DFoldWarpOverlayProps) {
  const fold = face.foldLine
  const isFoldTab = activeTab === 'fold' || tool === 'fold'
  const isWarpTab = activeTab === 'warp3x3' || tool === 'warp3x3'
  const showFoldLine = fold?.enabled || isFoldTab
  const showWarpGrid = (face.warp3x3Mode && face.warp3x3Mode !== 'none') || isWarpTab

  // Default fold line: across the middle horizontally or diagonally
  const p1 = fold?.p1 || [0.1, 0.5]
  const p2 = fold?.p2 || [0.9, 0.5]
  const angle = fold?.angle ?? 45
  const foldSide = fold?.foldSide || 'sideA'

  // Convert normalized UV to pixel coordinates
  const x1 = p1[0] * imgW
  const y1 = p1[1] * imgH
  const x2 = p2[0] * imgW
  const y2 = p2[1] * imgH

  // Center of line
  const midX = (x1 + x2) / 2
  const midY = (y1 + y2) / 2

  // Toggle fold side
  const handleToggleSide = () => {
    const nextSide = foldSide === 'sideA' ? 'sideB' : 'sideA'
    const curFold: OrigamiFoldLine = {
      enabled: true,
      p1,
      p2,
      angle,
      foldSide: nextSide
    }
    onUpdateFace(face.id, { foldLine: curFold })
  }

  return (
    <g className="mesh2d-fold-warp-overlay" pointerEvents="all">
      {/* 1. Photoshop 3x3 Warp Grid & Staircase Bands */}
      {showWarpGrid && (
        <g className="warp-3x3-layer">
          {/* Staircase Step Treads / Risers shading */}
          {face.warp3x3Mode === 'stairs' && (
            <>
              <rect
                x={0}
                y={0}
                width={imgW}
                height={imgH / 3}
                fill="rgba(56, 189, 248, 0.12)"
                stroke="none"
              />
              <rect
                x={0}
                y={imgH / 3}
                width={imgW}
                height={imgH / 3}
                fill="rgba(56, 189, 248, 0.22)"
                stroke="none"
              />
              <rect
                x={0}
                y={(imgH * 2) / 3}
                width={imgW}
                height={imgH / 3}
                fill="rgba(56, 189, 248, 0.32)"
                stroke="none"
              />
              <text x={12} y={20} fill="var(--accent-cyan)" fontSize={11} fontWeight={600}>
                Bậc 1 (Gốc)
              </text>
              <text x={12} y={imgH / 3 + 20} fill="var(--accent-cyan)" fontSize={11} fontWeight={600}>
                Bậc 2 (+{(face.warp3x3Intensity ?? 30) / 2}px)
              </text>
              <text x={12} y={(imgH * 2) / 3 + 20} fill="var(--accent-cyan)" fontSize={11} fontWeight={600}>
                Bậc 3 (+{face.warp3x3Intensity ?? 30}px)
              </text>
            </>
          )}

          {/* 3x3 Grid Lines */}
          {[1, 2].map((idx) => (
            <line
              key={`h_${idx}`}
              x1={0}
              y1={(imgH / 3) * idx}
              x2={imgW}
              y2={(imgH / 3) * idx}
              stroke="var(--accent-cyan)"
              strokeWidth={1.5}
              strokeDasharray="5 3"
            />
          ))}
          {[1, 2].map((idx) => (
            <line
              key={`v_${idx}`}
              x1={(imgW / 3) * idx}
              y1={0}
              x2={(imgW / 3) * idx}
              y2={imgH}
              stroke="var(--accent-cyan)"
              strokeWidth={1.5}
              strokeDasharray="5 3"
            />
          ))}

          {/* 16 Anchor control points (4x4) */}
          {[0, 1, 2, 3].map((r) =>
            [0, 1, 2, 3].map((c) => {
              const px = (imgW / 3) * c
              const py = (imgH / 3) * r
              return (
                <g key={`pt_${r}_${c}`}>
                  <circle
                    cx={px}
                    cy={py}
                    r={5}
                    fill="var(--bg-1)"
                    stroke="var(--accent-cyan)"
                    strokeWidth={2}
                  />
                  <circle cx={px} cy={py} r={2} fill="var(--accent-cyan)" />
                </g>
              )
            })
          )}
        </g>
      )}

      {/* 2. Origami 3D Fold Crease Line */}
      {showFoldLine && (
        <g className="origami-fold-line-layer">
          {/* Glowing Crease Line */}
          <line
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#f59e0b"
            strokeWidth={3}
            strokeDasharray="8 4"
            strokeLinecap="round"
          />

          {/* Crease line outer aura */}
          <line
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="rgba(245, 158, 11, 0.4)"
            strokeWidth={8}
            strokeLinecap="round"
            pointerEvents="none"
          />

          {/* Handle P1 */}
          <g>
            <circle cx={x1} cy={y1} r={8} fill="#f59e0b" stroke="#ffffff" strokeWidth={2} />
            <circle cx={x1} cy={y1} r={3} fill="#ffffff" />
          </g>

          {/* Handle P2 */}
          <g>
            <circle cx={x2} cy={y2} r={8} fill="#f59e0b" stroke="#ffffff" strokeWidth={2} />
            <circle cx={x2} cy={y2} r={3} fill="#ffffff" />
          </g>

          {/* Interactive Fold Side Switch Badge on crease line */}
          <g
            transform={`translate(${midX}, ${midY})`}
            style={{ cursor: 'pointer' }}
            onClick={handleToggleSide}
          >
            <rect
              x={-68}
              y={-14}
              width={136}
              height={28}
              rx={14}
              fill="rgba(15, 23, 42, 0.9)"
              stroke="#f59e0b"
              strokeWidth={1.5}
            />
            <text
              x={0}
              y={4}
              fill="#fbbf24"
              fontSize={10}
              fontWeight={700}
              textAnchor="middle"
              pointerEvents="none"
            >
              📦 {foldSide === 'sideA' ? 'Gấp Bên A' : 'Gấp Bên B'} ({angle > 0 ? `+${angle}°` : `${angle}°`})
            </text>
          </g>
        </g>
      )}
    </g>
  )
}
