import React, { Component, type ReactNode } from 'react'
import { loadDemo } from '../actions'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, info)
  }

  handleReload = (): void => {
    window.location.reload()
  }

  handleResetDemo = async (): Promise<void> => {
    try {
      await loadDemo(true)
      this.setState({ hasError: false, error: null })
    } catch {
      window.location.reload()
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
              maxWidth: 540,
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
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#f87171' }}>Đã xảy ra lỗi giao diện</h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>
                  Ứng dụng gặp sự cố và đã tự động giữ an toàn trạng thái
                </p>
              </div>
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
