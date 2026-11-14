import './remote/remoteEarlyInit'
import ReactDOM from 'react-dom/client'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/600.css'
import './index.css'
import App from './App'
import './styles/responsive.css'
import './styles/responsiveWorkspace.css'
import './styles/responsiveDialogs.css'
import './styles/remoteStudio.css'
import './styles/responsiveTouchStudio.css'
import { installRemoteWebApiBridge } from './remote/remoteWebApiBridge'
import { preloadWasmAccel } from './engine/wasmAccel'
import { ErrorBoundary } from './ui/ErrorBoundary'

installRemoteWebApiBridge()
void preloadWasmAccel()

// No StrictMode: double-mounted effects would create two WebGL renderers on one canvas context.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)
