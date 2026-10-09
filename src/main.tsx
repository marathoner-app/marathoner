import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import AuthProvider from './auth/AuthProvider.tsx'
import FirebaseBootstrapGate from './components/FirebaseBootstrapGate.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FirebaseBootstrapGate>
      <AuthProvider>
        <App />
      </AuthProvider>
    </FirebaseBootstrapGate>
  </StrictMode>,
)
