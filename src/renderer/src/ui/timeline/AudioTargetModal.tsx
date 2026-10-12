import React, { useRef, useState } from 'react'
import type { AudioCharacterRole, AudioTargetType, AudioTrackItem } from '@shared/types'
import { useEditor } from '../../store/editor'
import { assetStore } from '../../project/assets'
import {
  attachAudioTrackToTarget,
  getAvailableAudioTargets,
  replaceAudioTrackAsset
} from '../../project/audioTracks'
import { bakeLipSyncToCharacterLayer } from '../../project/lipSync'
import { toast } from '../../actions'
import { CustomSelect, type SelectOption } from '../controls/CustomSelect'
import {
  IconActionFx,
  IconCube,
  IconEye,
  IconFolder,
  IconLayerAssembly,
  IconLipSync,
  IconMusic,
  IconSparkles,
  IconVoiceDialogue,
  IconWindAmbience,
  IconX
} from '../icons'

export interface AudioTargetModalProps {
  track: AudioTrackItem
  onClose: () => void
}

export function AudioTargetModal({ track, onClose }: AudioTargetModalProps) {
  const project = useEditor((s) => s.project)
  const availableTargets = getAvailableAudioTargets(project, track.targetShotId)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [targetKey, setTargetKey] = useState<string>(() => {
    if (track.targetType && track.targetId) {
      return `${track.targetType}:${track.targetId}`
    }
    return 'ambient:none'
  })

  const [role, setRole] = useState<AudioCharacterRole>(track.characterRole || 'voice')
  const [lipSyncEnabled, setLipSyncEnabled] = useState<boolean>(track.lipSyncEnabled ?? (role === 'voice'))
  const [intensity, setIntensity] = useState<number>(track.lipSyncIntensity ?? 1.0)
  const [isBaking, setIsBaking] = useState<boolean>(false)

  // Xây dựng danh sách mục tiêu lựa chọn
  const targetOptions: SelectOption<string>[] = [
    {
      value: 'ambient:none',
      label: 'Âm thanh chung / Nhạc nền (Không gắn)',
      sub: 'Phát tự do trên timeline',
      icon: <IconWindAmbience width={12} height={12} />
    }
  ]

  // Gom nhóm nhân vật composite
  const charTargets = availableTargets.filter((t) => t.type === 'character')
  if (charTargets.length > 0) {
    for (const c of charTargets) {
      targetOptions.push({
        value: `character:${c.id}`,
        label: `👤 [Nhân vật] ${c.name}`,
        sub: `${c.layerCount || 0} lớp layer ${c.shotName ? `· Cảnh: ${c.shotName}` : ''}`,
        icon: <IconLayerAssembly width={12} height={12} />
      })
    }
  }

  // Gom nhóm mô hình 3D
  const modelTargets = availableTargets.filter((t) => t.type === 'model3d')
  if (modelTargets.length > 0) {
    for (const m of modelTargets) {
      targetOptions.push({
        value: `model3d:${m.id}`,
        label: `🏛️ [Khối 3D] ${m.name}`,
        sub: `${m.layerCount || 0} mặt ${m.shotName ? `· Cảnh: ${m.shotName}` : ''}`,
        icon: <IconCube width={12} height={12} />
      })
    }
  }

  // Gom nhóm layer đơn lẻ
  const layerTargets = availableTargets.filter((t) => t.type === 'layer')
  if (layerTargets.length > 0) {
    for (const l of layerTargets.slice(0, 30)) {
      targetOptions.push({
        value: `layer:${l.id}`,
        label: `🖼️ [Layer] ${l.name}`,
        sub: l.shotName ? `Cảnh: ${l.shotName}` : undefined,
        icon: <IconEye width={12} height={12} />
      })
    }
  }

  // Lựa chọn vai trò
  const roleOptions: SelectOption<AudioCharacterRole>[] = [
    {
      value: 'voice',
      label: '🎙️ Lồng tiếng / Giọng nói (Hội thoại)',
      sub: 'Hỗ trợ đồng bộ khẩu hình miệng Lip-sync',
      icon: <IconVoiceDialogue width={12} height={12} />
    },
    {
      value: 'sfx',
      label: '⚡ Hiệu ứng âm thanh (SFX)',
      sub: 'Âm thanh hành động hoặc tương tác',
      icon: <IconActionFx width={12} height={12} />
    },
    {
      value: 'footstep',
      label: '👟 Tiếng bước chân / Di chuyển',
      sub: 'Đồng bộ nhịp đi bộ của nhân vật',
      icon: <IconSparkles width={12} height={12} />
    },
    {
      value: 'foley',
      label: '🎬 Tiếng động đời thực (Foley)',
      sub: 'Quần áo, sột soạt, va chạm',
      icon: <IconMusic width={12} height={12} />
    },
    {
      value: 'bgm',
      label: '🎵 Nhạc nền riêng (Theme music)',
      sub: 'Nhạc chủ đề của nhân vật',
      icon: <IconMusic width={12} height={12} />
    }
  ]

  // Danh sách các audio asset trong project để thay thế nhanh
  const audioAssets = project.assets.filter((a) => a.kind === 'audio')
  const assetOptions: SelectOption<string>[] = audioAssets.map((a) => ({
    value: a.id,
    label: a.name,
    sub: a.duration ? `${a.duration.toFixed(1)}s` : undefined,
    icon: <IconMusic width={12} height={12} />
  }))

  const handleSave = () => {
    const [tType, tId] = targetKey.split(':')
    const selectedTarget = availableTargets.find((t) => t.id === tId)

    useEditor.getState().update((d) => {
      attachAudioTrackToTarget(d, track.id, {
        targetType: tType === 'ambient' ? 'ambient' : (tType as AudioTargetType),
        targetId: tType === 'ambient' ? undefined : tId,
        targetName: selectedTarget ? selectedTarget.name : undefined,
        targetShotId: selectedTarget?.shotId,
        characterRole: role,
        lipSyncEnabled: tType === 'character' || tType === 'layer' ? lipSyncEnabled : false,
        lipSyncIntensity: intensity
      })
    }, `Gắn âm thanh vào ${selectedTarget?.name || 'mục tiêu'}`)

    toast(`Đã gắn âm thanh vào ${selectedTarget ? selectedTarget.name : 'nhạc nền'}`)
    onClose()
  }

  const handleReplaceAsset = (newAssetId: string) => {
    useEditor.getState().update((d) => {
      replaceAudioTrackAsset(d, track.id, newAssetId)
    }, 'Thay thế tệp âm thanh')
    toast('Đã thay thế tệp âm thanh mới')
  }

  const handleUploadAndReplace = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const data = new Uint8Array(await file.arrayBuffer())
      const mime = file.type || 'audio/mpeg'
      const asset = await assetStore.add(file.name, mime, data, 'audio')
      useEditor.getState().update((d) => {
        if (!d.assets.some((a) => a.id === asset.meta.id)) {
          d.assets.push(asset.meta)
        }
        replaceAudioTrackAsset(d, track.id, asset.meta.id, file.name)
      }, `Nạp và thay thế âm thanh: ${file.name}`)

      toast(`Đã nạp và thay thế âm thanh: ${file.name}`)
    } catch (err) {
      console.error('Lỗi khi nạp file âm thanh:', err)
      toast('Không thể nạp tệp âm thanh')
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleBakeLipSync = async () => {
    setIsBaking(true)
    try {
      const res = await bakeLipSyncToCharacterLayer(useEditor.getState().project, track.id, {
        intensity
      })
      if (res.success) {
        toast(`Đã nướng ${res.bakedKeyframeCount} keyframe khẩu hình vào Timeline!`)
      } else {
        toast('Không tìm thấy layer miệng phù hợp để nướng keyframe')
      }
    } catch (err) {
      console.error('Lỗi nướng lip-sync:', err)
      toast('Lỗi khi nướng keyframe khẩu hình')
    } finally {
      setIsBaking(false)
    }
  }

  const isCharSelected = targetKey.startsWith('character:')
  const isLayerSelected = targetKey.startsWith('layer:')

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(3px)',
        zIndex: 60000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="modal-card"
        style={{
          background: 'var(--bg-1, #12141a)',
          border: '1px solid var(--line, rgba(255, 255, 255, 0.12))',
          borderRadius: 8,
          width: 520,
          maxWidth: '100%',
          boxShadow: '0 20px 45px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--line-soft, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-2, #181b22)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: 5,
                background: 'rgba(99, 102, 241, 0.18)',
                color: 'var(--accent, #6366f1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <IconVoiceDialogue width={14} height={14} />
            </span>
            <div>
              <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text)' }}>
                Gắn Mục Tiêu & Cử Động Miệng (Lip-Sync)
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                Đoạn âm thanh: <strong style={{ color: 'var(--text)' }}>{track.name || 'Audio'}</strong>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="mini"
            title="Đóng (Esc)"
            onClick={onClose}
            style={{ color: 'var(--text-dim)' }}
          >
            <IconX width={14} height={14} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* 1. Chọn mục tiêu */}
          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6 }}>
              Mục tiêu gắn âm thanh (Nhân vật / 3D / Layer):
            </label>
            <CustomSelect
              value={targetKey}
              onChange={(val) => setTargetKey(val)}
              options={targetOptions}
              placeholder="Chọn mục tiêu..."
            />
          </div>

          {/* 2. Vai trò âm thanh */}
          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6 }}>
              Vai trò âm thanh (Role):
            </label>
            <CustomSelect
              value={role}
              onChange={(val) => {
                setRole(val as AudioCharacterRole)
                if (val === 'voice') setLipSyncEnabled(true)
              }}
              options={roleOptions}
            />
          </div>

          {/* 3. Cấu hình cử động miệng Lip-sync nếu là nhân vật hoặc layer */}
          {(isCharSelected || isLayerSelected) && (
            <div
              style={{
                background: 'rgba(244, 63, 94, 0.06)',
                border: '1px solid rgba(244, 63, 94, 0.25)',
                borderRadius: 6,
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={lipSyncEnabled}
                    onChange={(e) => setLipSyncEnabled(e.target.checked)}
                    style={{ cursor: 'pointer', accentColor: '#f43f5e' }}
                  />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#fda4af', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <IconLipSync width={14} height={14} />
                    Kích hoạt khẩu hình miệng tự động (Lip-Sync)
                  </span>
                </label>

                <button
                  type="button"
                  className="btn"
                  disabled={!lipSyncEnabled || isBaking}
                  title="Nướng trực tiếp keyframe hé mở miệng theo sóng âm lên Timeline"
                  onClick={handleBakeLipSync}
                  style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    background: 'rgba(244, 63, 94, 0.15)',
                    color: '#fda4af',
                    border: '1px solid rgba(244, 63, 94, 0.4)',
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  <IconSparkles width={11} height={11} />
                  {isBaking ? 'Đang nướng...' : 'Nướng keyframe Timeline'}
                </button>
              </div>

              {lipSyncEnabled && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                    Độ mở miệng ({intensity.toFixed(1)}x):
                  </span>
                  <input
                    type="range"
                    min="0.3"
                    max="2.5"
                    step="0.1"
                    value={intensity}
                    onChange={(e) => setIntensity(parseFloat(e.target.value))}
                    style={{ flex: 1, accentColor: '#f43f5e' }}
                  />
                </div>
              )}
            </div>
          )}

          {/* 4. Thay thế tệp âm thanh (Replace Audio) */}
          <div
            style={{
              paddingTop: 8,
              borderTop: '1px solid var(--line-soft, rgba(255, 255, 255, 0.08))',
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-dim)' }}>
                Đổi / Thay thế âm thanh cho track này:
              </label>
              <button
                type="button"
                className="btn"
                onClick={handleUploadAndReplace}
                title="Mở file âm thanh mới từ máy tính để thay thế"
                style={{
                  fontSize: '11px',
                  padding: '3px 8px',
                  background: 'var(--bg-3)',
                  border: '1px solid var(--line)',
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <IconFolder width={11} height={11} />
                Nạp tệp từ máy...
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </div>

            {assetOptions.length > 1 && (
              <CustomSelect
                value={track.assetId}
                onChange={handleReplaceAsset}
                options={assetOptions}
                placeholder="Chọn tệp âm thanh có sẵn..."
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--line-soft, rgba(255, 255, 255, 0.08))',
            background: 'var(--bg-2, #181b22)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8
          }}
        >
          <button type="button" className="btn" onClick={onClose} style={{ fontSize: '12px', padding: '5px 12px' }}>
            Hủy
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={handleSave}
            style={{
              fontSize: '12px',
              padding: '5px 14px',
              background: 'var(--accent, #6366f1)',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              fontWeight: 600
            }}
          >
            Áp dụng liên kết
          </button>
        </div>
      </div>
    </div>
  )
}
