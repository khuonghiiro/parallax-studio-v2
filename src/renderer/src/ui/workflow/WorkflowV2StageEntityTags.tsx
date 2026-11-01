import React from 'react'

export interface WorkflowV2StageEntityTagsProps {
  entities: Array<{
    ent: { id: string; name: string }
    accentColor: string
    entTargetScalePct: number
  }>
  focusedEntityId?: string
  onSelectEntity: (id: string) => void
}

/**
 * Thanh Chip Tags chọn nhanh BBox đích trên Stage khi có từ 2 Layer/Cụm kết nối trở lên.
 * Giúp người dùng click chọn ngay lập tức kể cả khi một BBox nhỏ nằm lọt thỏm bên trong BBox to.
 */
export const WorkflowV2StageEntityTags: React.FC<WorkflowV2StageEntityTagsProps> = ({
  entities,
  focusedEntityId,
  onSelectEntity
}) => {
  return (
    <div
      className="wf-v2-stage-entity-tags"
      data-mcp-region="workflow_motion_entity_tags"
      style={{
        position: 'absolute',
        top: 6,
        left: 8,
        right: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        flexWrap: 'wrap',
        zIndex: 48,
        pointerEvents: 'auto'
      }}
    >
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: 'rgba(255, 255, 255, 0.90)',
          background: 'rgba(15, 23, 42, 0.88)',
          padding: '2px 6px',
          borderRadius: 3,
          backdropFilter: 'blur(4px)',
          border: '1px solid rgba(255, 255, 255, 0.18)',
          userSelect: 'none'
        }}
      >
        🎯 Chọn BBox:
      </span>
      {entities.map((item) => {
        const isItemFocused = item.ent.id === focusedEntityId
        const chipName = item.ent.name.length > 12 ? `${item.ent.name.slice(0, 10)}…` : item.ent.name
        return (
          <button
            key={`chip-ent-${item.ent.id}`}
            type="button"
            className={`wf-v2-stage-chip${isItemFocused ? ' active' : ''}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 7px',
              borderRadius: 3,
              fontSize: 9.5,
              fontWeight: isItemFocused ? 700 : 500,
              background: isItemFocused
                ? `color-mix(in srgb, ${item.accentColor} 85%, #0f172a)`
                : 'rgba(15, 23, 42, 0.80)',
              color: isItemFocused ? '#ffffff' : 'rgba(255, 255, 255, 0.78)',
              border: isItemFocused
                ? `1px solid color-mix(in srgb, ${item.accentColor} 60%, #ffffff)`
                : `1px solid color-mix(in srgb, ${item.accentColor} 30%, transparent)`,
              boxShadow: isItemFocused
                ? `0 2px 8px rgba(0, 0, 0, 0.4), 0 0 10px color-mix(in srgb, ${item.accentColor} 50%, transparent)`
                : 'none',
              cursor: 'pointer',
              userSelect: 'none',
              backdropFilter: 'blur(4px)'
            }}
            title={`Chọn BBox đích của "${item.ent.name}" (${item.entTargetScalePct}%)`}
            onClick={() => onSelectEntity(item.ent.id)}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: item.accentColor,
                boxShadow: `0 0 4px ${item.accentColor}`
              }}
            />
            <span style={{ maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {chipName}
            </span>
            {isItemFocused && (
              <span style={{ fontSize: 8, opacity: 0.9, marginLeft: 2 }}>✓</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
