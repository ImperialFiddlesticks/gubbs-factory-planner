import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { replaceCatalogFromServer } from './data/catalog'
import { listMachineTypesFromServer } from './lib/machineTypeApi'
import './index.css'
import App from './App.tsx'

const root = createRoot(document.getElementById('root')!)

function renderApp() {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

/** Longest wait for the web font before rendering anyway, ms. */
const FONT_TIMEOUT_MS = 1500

// The Konva canvas measures text when it is first drawn and cannot pick up a font that
// arrives later, so wait (briefly) for Nunito before the first render.
async function waitForFonts() {
  if (!('fonts' in document)) return
  const loads = Promise.all(['400 12px Nunito', '700 12px Nunito'].map((font) => document.fonts.load(font)))
  await Promise.race([loads, new Promise((resolve) => setTimeout(resolve, FONT_TIMEOUT_MS))]).catch(() => {})
}

// Show the built-in catalog as soon as the font is ready, then use the backend catalog when available.
const fontsReady = waitForFonts()
void fontsReady.then(renderApp)
void listMachineTypesFromServer()
  .then(async (catalog) => {
    replaceCatalogFromServer(catalog)
    await fontsReady
    renderApp()
  })
  .catch((error: unknown) => {
    console.warn('Could not load machine types from the backend; using the built-in catalog.', error)
  })
