import { createRoot } from 'react-dom/client'

import '../../src/index.css'
import {
  AccountDeletionDialog,
} from '../../src/components/AccountDeletion'
import type { GarminConnectionClient } from '../../src/services/garminConnectionClient'

const root = document.querySelector('#root')
if (root === null) {
  throw new Error('Account settings viewport fixture root was not found.')
}

const connectedClient: GarminConnectionClient = {
  start: async () => ({
    status: 'ready',
    authorizationUrl: 'https://provider.invalid/authorize',
  }),
  getStatus: async () => ({
    status: 'connected',
    connectedAt: '2026-11-04T20:00:00.000Z',
  }),
  disconnect: async () => ({ status: 'disconnected' }),
}

createRoot(root).render(
  <AccountDeletionDialog
    accountScope="viewport-runner"
    email="runner@example.com"
    supportEmail="support@example.com"
    unresolvedCommandId={null}
    onAccepted={() => undefined}
    onClose={() => undefined}
    onUnresolvedCommandChange={() => undefined}
    garminClient={connectedClient}
  />,
)
