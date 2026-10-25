import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { Project, Shot, WorkflowGraph } from '@shared/types'
import { useEditor } from '../../store/editor'
import {
  applyModularWorkflowJson,
  buildMainWorkflowJson,
  buildModularWorkflowBundle,
  buildShotWorkflowJson
} from '../../project/workflowV2Engine'
import { CustomSelect } from '../controls/CustomSelect'
import { IconCheck, IconCopy, IconDownload, IconUpload } from '../icons'

export type WorkflowJsonDocTarget = 'main' | 'bundle' | string

export interface WorkflowV2JsonPanelProps {
  project: Project
  workflow: WorkflowGraph
  shots: { shot: Shot; index: number }[]
  activeShotId: string | null
  focusedShotId: string | null
  onSelectShotFocus: (shotId: string | null) => void
}

const MAX_SHOT_CHAIN_PILLS = 5

export const WorkflowV2JsonPanel: React.FC<WorkflowV2JsonPanelProps> = ({
  project,
  workflow,
  shots,
  activeShotId,
  focusedShotId,
  onSelectShotFocus
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [docTarget, setDocTarget] = useState<WorkflowJsonDocTarget>(() => focusedShotId ?? activeShotId ?? 'main')
  const [draftText, setDraftText] = useState('')
  const [dirty, setDirty] = useState(false)
  const [statusMsg, setStatusMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [copied, setCopied] = useState(false)

  // Khi chuyển sang cảnh khác trên thanh công cụ / sơ đồ / timeline → tự chuyển sang JSON đơn lẻ của cảnh đó
  useEffect(() => {
    if (focusedShotId && project.shots.some((s) => s.id === focusedShotId)) {
      setDocTarget(focusedShotId)
      setDirty(false)
      setStatusMsg(null)
    } else if (focusedShotId === null && docTarget !== 'bundle') {
      setDocTarget('main')
      setDirty(false)
      setStatusMsg(null)
    }
  }, [focusedShotId, project.shots])

  const currentDocInfo = useMemo(() => {
    if (docTarget === 'main') {
      const data = buildMainWorkflowJson(project, workflow)
      return {
        fileName: 'main.json',
        subtitle: 'Kết nối tổng',
        badge: `${data.route.length} cảnh · ${data.connections.length} chuyển cảnh`,
        json: JSON.stringify(data, null, 2)
      }
    }
    if (docTarget === 'bundle') {
      const data = buildModularWorkflowBundle(project, workflow)
      return {
        fileName: 'workflow-bundle.json',
        subtitle: 'Gói toàn dự án',
        badge: `main.json + ${Object.keys(data.shots).length} file cảnh`,
        json: JSON.stringify(data, null, 2)
      }
    }
    const targetId = project.shots.some((s) => s.id === docTarget) ? docTarget : (shots[0]?.shot.id ?? 'main')
    if (targetId === 'main') {
      const data = buildMainWorkflowJson(project, workflow)
      return {
        fileName: 'main.json',
        subtitle: 'Kết nối tổng',
        badge: `${data.route.length} cảnh`,
        json: JSON.stringify(data, null, 2)
      }
    }
    const data = buildShotWorkflowJson(project, targetId, workflow)
    return {
      fileName: data.file,
      subtitle: data.shot.name,
      badge: `${data.layers.length}L · ${data.logic.length} logic · ${data.shot.timeStart}–${data.shot.timeEnd}s`,
      json: JSON.stringify(data, null, 2)
    }
  }, [docTarget, project, workflow, shots])

  useEffect(() => {
    if (!dirty) {
      setDraftText(currentDocInfo.json)
    }
  }, [currentDocInfo.json, dirty])

  const docOptions = useMemo(
    () => [
      { value: 'main', label: 'main.json — Kết nối tổng' },
      ...shots.map(({ shot, index }) => ({
        value: shot.id,
        label: `shot-${index + 1}.json — #${index + 1} ${shot.name}`
      })),
      { value: 'bundle', label: 'workflow-bundle.json — Trọn bộ' }
    ],
    [shots]
  )

  const handleSwitchDoc = (next: WorkflowJsonDocTarget): void => {
    setDocTarget(next)
    setDirty(false)
    setStatusMsg(null)
    if (next !== 'main' && next !== 'bundle') {
      onSelectShotFocus(next)
    }
  }

  const handleApplyJson = (sourceText = draftText): void => {
    try {
      const defaultShotId = docTarget !== 'main' && docTarget !== 'bundle' ? docTarget : null
      let summary = ''
      useEditor.getState().update((draft) => {
        const res = applyModularWorkflowJson(draft as Project, sourceText, defaultShotId)
        summary = res.summary
      }, `Áp dụng JSON (${currentDocInfo.fileName})`)
      setDirty(false)
      setStatusMsg({ kind: 'ok', text: summary })
    } catch (err) {
      setStatusMsg({ kind: 'err', text: err instanceof Error ? err.message : String(err) })
    }
  }

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(draftText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setStatusMsg({ kind: 'err', text: 'Không thể sao chép vào bộ nhớ tạm.' })
    }
  }

  const handleDownload = (): void => {
    const blob = new Blob([draftText], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = currentDocInfo.fileName.replace(/\//g, '-')
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    setStatusMsg({ kind: 'ok', text: `Đã xuất ${currentDocInfo.fileName}` })
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      setDraftText(text)
      handleApplyJson(text)
    } catch (err) {
      setStatusMsg({ kind: 'err', text: `Lỗi đọc file: ${err instanceof Error ? err.message : String(err)}` })
    }
  }

  return (
    <div className="wf-json-panel wf-v2-json-panel" data-mcp-region="workflow_json_panel">
      {/* Thanh liên kết kiến trúc JSON độc lập: main.json ⇄ shot-1.json → shot-2.json ... */}
      {shots.length <= MAX_SHOT_CHAIN_PILLS ? (
        <div className="wf-v2-json-chain" role="group" aria-label="Chọn file JSON của dự án hoặc từng cảnh">
          <button
            type="button"
            className={`wf-v2-json-node main${docTarget === 'main' ? ' active' : ''}`}
            onClick={() => handleSwitchDoc('main')}
            title="main.json — File JSON tổng kết nối lộ trình Camera và các cảnh"
          >
            🔗 main.json
          </button>
          <span className="wf-v2-json-arrow" aria-hidden="true">⇄</span>
          {shots.map(({ shot, index }, i) => {
            const isLive = shot.id === activeShotId
            return (
              <React.Fragment key={shot.id}>
                {i > 0 && <span className="wf-v2-json-arrow" aria-hidden="true">→</span>}
                <button
                  type="button"
                  className={`wf-v2-json-node shot${docTarget === shot.id ? ' active' : ''}`}
                  onClick={() => handleSwitchDoc(shot.id)}
                  title={`shots/shot-${index + 1}.json — #${index + 1} ${shot.name}`}
                >
                  <span className="dot" style={{ background: shot.color || '#38bdf8' }} />
                  <span>shot-{index + 1}</span>
                  {isLive && <span className="wf-v2-live-dot" aria-hidden="true" />}
                </button>
              </React.Fragment>
            )
          })}
          <button
            type="button"
            className={`wf-v2-json-node bundle${docTarget === 'bundle' ? ' active' : ''}`}
            onClick={() => handleSwitchDoc('bundle')}
            title="workflow-bundle.json — Gói hợp nhất gồm main.json và mọi shot-N.json"
          >
            Trọn bộ
          </button>
        </div>
      ) : (
        <CustomSelect size="sm" value={docTarget} options={docOptions} onChange={handleSwitchDoc} />
      )}

      <div className="wf-v2-json-meta">
        <code className="wf-v2-json-file">{currentDocInfo.fileName}</code>
        <strong className="wf-v2-json-sub" title={currentDocInfo.subtitle}>{currentDocInfo.subtitle}</strong>
        <span className="wf-v2-json-badge" title={currentDocInfo.badge}>{currentDocInfo.badge}</span>
        <span className={`wf-v2-json-state${dirty ? ' dirty' : ' synced'}`}>
          {dirty ? 'Đã sửa' : 'Đồng bộ'}
        </span>
      </div>

      <textarea
        className="wf-v2-json-editor"
        spellCheck={false}
        aria-label={`Nội dung JSON của ${currentDocInfo.fileName}`}
        value={draftText}
        onChange={(e) => {
          setDraftText(e.target.value)
          setDirty(true)
          if (statusMsg) setStatusMsg(null)
        }}
      />

      {statusMsg && (
        <div className={`wf-v2-json-status ${statusMsg.kind}`} role="status">
          {statusMsg.text}
        </div>
      )}

      <div className="wf-v2-json-actions">
        <button
          type="button"
          className="btn primary sm wf-v2-tool-btn primary-apply"
          onClick={() => handleApplyJson()}
          title="Áp dụng nội dung JSON hiện tại xuống cảnh / dự án (hỗ trợ Ctrl+Z)"
        >
          <IconCheck width={12} height={12} />
          <span>Áp dụng JSON</span>
        </button>
        {dirty && (
          <button
            type="button"
            className="btn ghost sm wf-v2-tool-btn"
            onClick={() => {
              setDraftText(currentDocInfo.json)
              setDirty(false)
              setStatusMsg(null)
            }}
            title="Khôi phục JSON theo trạng thái hiện tại của cảnh"
          >
            Khôi phục
          </button>
        )}
        <button type="button" className="btn ghost sm wf-v2-tool-btn" onClick={handleCopy} title="Sao chép JSON vào clipboard">
          <IconCopy width={12} height={12} />
          <span>{copied ? 'Đã chép' : 'Chép'}</span>
        </button>
        <button type="button" className="btn ghost sm wf-v2-tool-btn" onClick={handleDownload} title={`Tải file ${currentDocInfo.fileName} về máy`}>
          <IconDownload width={12} height={12} />
          <span>Xuất .json</span>
        </button>
        <button
          type="button"
          className="btn ghost sm wf-v2-tool-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Nhập file .json (main.json, shot-N.json hoặc bundle.json)"
        >
          <IconUpload width={12} height={12} />
          <span>Nhập .json</span>
        </button>
        <input ref={fileInputRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleImportFile} />
      </div>
    </div>
  )
}
