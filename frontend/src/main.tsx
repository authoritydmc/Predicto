import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/App.css'
import './styles/ui-overrides.css'
import './styles/visualize_data.css'
import App from './App.tsx'

document.body.classList.add('app-shell');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

