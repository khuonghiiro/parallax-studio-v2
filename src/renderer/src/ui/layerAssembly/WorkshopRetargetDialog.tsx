import { useMemo, useState } from 'react'
import type { AnimationClip, LayerBone } from '@shared/layerRig'
import type { LayerComposite } from './types'
import { getStoredComposites } from './layerAssemblyStorage'
import { mapBonesBetweenArmatures } from './workshopRetarget'
import { Select } from '../controls'
import { IconCopy } from '../icons'

export interface WorkshopRetargetDialogProps {
  isOpen: boolean
  onClose: () => void
  targetComposite: LayerComposite
  onInherit: (sourceClip: AnimationClip, sourceBones: LayerBone[], clipName?: string) => void
}

export function WorkshopRetargetDialog({
  isOpen,
  onClose,
  targetComposite,
  onInherit
}: WorkshopRetargetDialogProps) {
  const targetBones = targetComposite.rig?.bones ?? []

  // Lấy các chi tiết khác có khung xương để làm nguồn kế thừa
  const availableSources = useMemo(() => {
    return getStoredComposites().filter(
      (c) => c.rig && c.rig.bones.length > 0 && c.id !== targetComposite.id
    )
  }, [targetComposite.id])

  const [selectedSourceId, setSelectedSourceId] = useState<string>(
    availableSources[0]?.id ?? ''
  )

  const selectedSource = useMemo(() => {
    return availableSources.find((c) => c.id === selectedSourceId)
  }, [availableSources, selectedSourceId])

  const sourceClips: AnimationClip[] = useMemo(() => {
    if (!selectedSource?.rig) return []
    if (selectedSource.rig.clips && selectedSource.rig.clips.length > 0) {
      return selectedSource.rig.clips
    }
    return [
      {
        id: 'orig',
        name: selectedSource.name || 'Động tác gốc',
        duration: selectedSource.rig.duration || 2.0,
        loop: selectedSource.rig.loop ?? true,
        tracks: selectedSource.rig.tracks || {}
      }
    ]
  }, [selectedSource])

  const [selectedClipId, setSelectedClipId] = useState<string>(
    sourceClips[0]?.id ?? ''
  )

  const selectedClip = useMemo(() => {
    return sourceClips.find((c) => c.id === selectedClipId) ?? sourceClips[0]
  }, [sourceClips, selectedClipId])

  // Tính toán số lượng xương khớp tương thích
  const mappingStats = useMemo(() => {
    if (!selectedSource?.rig) return { mappedCount: 0, totalTarget: targetBones.length }
    const mapping = mapBonesBetweenArmatures(selectedSource.rig.bones, targetBones)
    return {
      mappedCount: mapping.size,
      totalTarget: targetBones.length,
      totalSource: selectedSource.rig.bones.length
    }
  }, [selectedSource, targetBones])

  if (!isOpen) return null

  const handleApply = () => {
    if (!selectedClip || !selectedSource?.rig) return
    const name = `${selectedClip.name} (${selectedSource.name})`
    onInherit(selectedClip, selectedSource.rig.bones, name)
    onClose()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        zIndex: 60000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '420px',
          maxWidth: '92vw',
          background: 'var(--bg-1)',
          border: '1px solid var(--line-focus)',
          borderRadius: '8px',
          padding: '16px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
          color: 'var(--text)',
          fontSize: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <IconCopy width={14} height={14} /> Kế thừa động tác từ chi tiết khác
          </h3>
          <button
            type="button"
            className="btn xs icon"
            onClick={onClose}
            style={{ width: '22px', height: '22px' }}
          >
            ×
          </button>
        </div>

        <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: '11px', lineHeight: 1.5 }}>
          Hệ thống sẽ tự động đối chiếu các khớp xương (hông, ngực, tay, chân...) và sao chép quỹ đạo góc xoay, dời vị trí sang nhân vật hiện tại.
        </p>

        {availableSources.length === 0 ? (
          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-faint)' }}>
            Không tìm thấy nhân vật hoặc chi tiết nào khác có gắn xương trong thư viện để kế thừa.
          </div>
        ) : (
          <>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>
                1. Chọn nhân vật / chi tiết nguồn:
              </label>
              <Select
                size="sm"
                value={selectedSourceId}
                options={availableSources.map((c) => ({
                  value: c.id,
                  label: `${c.name} (${c.rig?.bones.length} xương)`
                }))}
                onChange={(val) => {
                  setSelectedSourceId(String(val))
                  setSelectedClipId('')
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>
                2. Chọn động tác muốn kế thừa:
              </label>
              <Select
                size="sm"
                value={selectedClip?.id ?? ''}
                options={sourceClips.map((clip) => ({
                  value: clip.id,
                  label: `${clip.name} (${clip.duration}s)`
                }))}
                onChange={(val) => setSelectedClipId(String(val))}
              />
            </div>

            <div
              style={{
                background: 'var(--bg-0)',
                border: '1px solid var(--line-soft)',
                borderRadius: '5px',
                padding: '8px 10px',
                fontSize: '11px'
              }}
            >
              <div style={{ color: 'var(--text-dim)', marginBottom: '3px' }}>Độ tương thích khung xương:</div>
              <div style={{ fontWeight: 600, color: mappingStats.mappedCount > 0 ? 'var(--accent)' : 'var(--text-faint)' }}>
                {mappingStats.mappedCount} / {mappingStats.totalTarget} xương khớp được ánh xạ thành công ({Math.round((mappingStats.mappedCount / (mappingStats.totalTarget || 1)) * 100)}%)
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
              <button type="button" className="btn sm" onClick={onClose}>
                Hủy bỏ
              </button>
              <button
                type="button"
                className="btn sm primary"
                disabled={!selectedClip || mappingStats.mappedCount === 0}
                onClick={handleApply}
              >
                Áp dụng kế thừa động tác
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
