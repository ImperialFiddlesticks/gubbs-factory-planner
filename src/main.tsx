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

// Show the built-in catalog immediately, then use the backend catalog when available.
renderApp()
void listMachineTypesFromServer()
  .then((catalog) => {
    replaceCatalogFromServer(catalog)
    renderApp()
  })
  .catch((error: unknown) => {
    console.warn('Could not load machine types from the backend; using the built-in catalog.', error)
  })
