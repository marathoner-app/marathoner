import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import AuthProvider from './auth/AuthProvider.tsx'
import FirebaseBootstrapGate from './components/FirebaseBootstrapGate.tsx'
import { registerModulePreloadRecovery } from './deployment/modulePreloadRecovery.ts'
import { installIosDynamicType } from './services/iosDynamicType.ts'

registerModulePreloadRecovery()
installIosDynamicType()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FirebaseBootstrapGate>
      <AuthProvider>
        <App />
      </AuthProvider>
    </FirebaseBootstrapGate>
  </StrictMode>,
)
