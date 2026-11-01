import React, { Component, type ReactNode } from 'react'
import { loadDemo } from '../actions'
import { initMcp } from '../mcp/commands'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo?: React.ErrorInfo | null
  copied?: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  private copyTimeout: ReturnType<typeof setTimeout> | null = null

  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null, copied: false }
  }

  componentDidMount(): void {
    initMcp()
  }

  componentWillUnmount(): void {
    if (this.copyTimeout) {
      clearTimeout(this.copyTimeout)
      this.copyTimeout = null
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, info)
    this.setState({ errorInfo: info })
    ;(window as unknown as { __pxsLastRenderError?: string }).__pxsLastRenderError =
      error?.stack || error?.message || String(error)
    initMcp()
  }

  handleHardReload = (): void => {
    window.location.reload()
  }

  handleReload = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null, copied: false })
  }

  _unusedReload = (): void => {
    window.location.reload()
  }

  handleResetDemo = async (): Promise<void> => {
    try {
      await loadDemo(true)
      this.setState({ hasError: false, error: null, errorInfo: null, copied: false })
    } catch {
      window.location.reload()
    }
  }

  handleCopyError = async (): Promise<void> => {
    const err = this.state.error
    const info = this.state.errorInfo
    const text = [
      '=== PARALLAX STUDIO ERROR REPORT ===',
      `Thời gian: ${new Date().toLocaleString()}`,
      `Lỗi: ${err?.name || 'Error'}: ${err?.message || String(err)}`,
      '',
      '--- Error Stack ---',
      err?.stack || '(Không có stack)',
      '',
      '--- Component Stack ---',
      info?.componentStack || '(Không có component stack)'
    ].join('\n')

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      this.setState({ copied: true })
      if (this.copyTimeout) clearTimeout(this.copyTimeout)
      this.copyTimeout = setTimeout(() => this.setState({ copied: false }), 2500)
    } catch (e) {
      console.error('Không thể sao chép lỗi vào clipboard:', e)
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0d0f17',
            color: '#e2e8f0',
            fontFamily: 'Inter, system-ui, sans-serif',
            padding: '24px',
            zIndex: 999999
          }}
        >
          <div
            style={{
              maxWidth: 580,
              width: '100%',
              background: '#151928',
              border: '1px solid #2d3548',
              borderRadius: 12,
              padding: 24,
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444',
                  fontSize: 20
                }}
              >
                ⚠️
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#f87171' }}>
                  Đã xảy ra lỗi giao diện
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>
                  Ứng dụng gặp sự cố và đã tự động giữ an toàn trạng thái
                </p>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>Chi tiết lỗi:</span>
              <button
                type="button"
                onClick={this.handleCopyError}
                style={{
                  padding: '5px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  background: this.state.copied ? '#059669' : '#222938',
                  color: this.state.copied ? '#ffffff' : '#cbd5e1',
                  border: this.state.copied ? '1px solid #10b981' : '1px solid #374151',
                  borderRadius: 6,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.18s ease'
                }}
                title="Sao chép toàn bộ thông điệp lỗi và call stack để gửi cho AI hỗ trợ sửa lỗi"
              >
                {this.state.copied ? '✓ Đã sao chép chi tiết lỗi!' : '📋 Sao chép lỗi'}
              </button>
            </div>

            <pre
              style={{
                background: '#0a0c13',
                border: '1px solid #1e2433',
                borderRadius: 8,
                padding: 12,
                fontSize: 12,
                color: '#fca5a5',
                overflowX: 'auto',
                maxHeight: 180,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'JetBrains Mono, monospace'
              }}
            >
              {this.state.error?.message || String(this.state.error)}
            </pre>

            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button
                className="btn primary"
                onClick={this.handleReload}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                ↩ Tiếp tục phiên làm việc
              </button>
              <button
                className="btn"
                onClick={this.handleHardReload}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: '#1e293b',
                  color: '#e2e8f0',
                  border: '1px solid #334155',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                🔄 Tải lại trang (F5)
              </button>
              <button
                className="btn"
                onClick={this.handleResetDemo}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: '#222938',
                  color: '#cbd5e1',
                  border: '1px solid #374151',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                ✨ Mở lại cảnh mẫu
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
