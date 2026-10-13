import { IconCamera, IconFolder, IconSettings } from '../icons'

export type WorkspacePanel = 'viewer' | 'library' | 'inspector'

const panels = [
  { id: 'library', label: 'Tài nguyên & Cảnh', target: 'workspace-library', Icon: IconFolder },
  { id: 'viewer', label: 'Khung hình', target: 'workspace-viewer', Icon: IconCamera },
  { id: 'inspector', label: 'Thuộc tính', target: 'workspace-inspector', Icon: IconSettings }
] as const

export function WorkspaceNavigation({ active, onChange }: {
  active: WorkspacePanel
  onChange: (panel: WorkspacePanel) => void
}) {
  return (
    <nav className="workspace-navigation" aria-label="Khu vực làm việc">
      {panels.map(({ id, label, target, Icon }) => (
        <button key={id} id={`workspace-show-${id}`} type="button"
          className="workspace-panel-button" aria-pressed={active === id}
          aria-controls={target} onClick={() => onChange(id)}>
          <Icon width={16} height={16} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}
