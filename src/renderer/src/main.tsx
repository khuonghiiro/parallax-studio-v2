import ReactDOM from 'react-dom/client'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/600.css'
import '@fontsource/montserrat/400.css'
import '@fontsource/montserrat/700.css'
import '@fontsource/montserrat/800.css'
import '@fontsource/playfair-display/400.css'
import '@fontsource/playfair-display/700.css'
import '@fontsource/bebas-neue/400.css'
import './index.css'
import App from './App'
import './styles/responsive.css'
import './styles/responsiveWorkspace.css'
import './styles/responsiveDialogs.css'
import { initMcp } from './mcp/commands'
import { ErrorBoundary } from './ui/ErrorBoundary'

initMcp()

// No StrictMode: double-mounted effects would create two WebGL renderers on one canvas context.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)
