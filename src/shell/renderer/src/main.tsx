/**
 * Renderer entry used only by `pnpm dev` (no host session).
 * `dsh --profile gui` loads the official web client via the custom protocol.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { APP_NAME } from '../../shared/index.ts'

function App() {
  return (
    <main style={{ fontFamily: 'system-ui', padding: 48, lineHeight: 1.5 }}>
      <h1>{APP_NAME}</h1>
      <p>
        This window is the development placeholder. The official web client
        is assembled when the host launches the shell:{' '}
        <code>dsh --profile gui</code>.
      </p>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
