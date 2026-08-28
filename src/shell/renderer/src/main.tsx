/**
 * Renderer entry for the dsh-gui shell. Scaffold stage: placeholder page.
 * Design stage: this hosts the official dsh web client (loaded via file://)
 * with its fetch routed through the IPC carrier installed by the preload.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { APP_NAME, APP_STAGE } from '../../shared/index.ts'

function App() {
  return (
    <main style={{ fontFamily: 'system-ui', padding: 48 }}>
      <h1>{APP_NAME}</h1>
      <p>
        Shell scaffold ({APP_STAGE} stage). The official dsh web client
        assembly lands at design stage — see AGENTS.md for the project map.
      </p>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
