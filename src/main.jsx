import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App, { DisplayApp } from './App.jsx'

const isDisplay = new URLSearchParams(location.search).get('mode') === 'display';

createRoot(document.getElementById('root')).render(
  <StrictMode>{isDisplay ? <DisplayApp/> : <App/>}</StrictMode>
)
