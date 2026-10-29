import { createPlanApprovalClient } from './planApprovalClient'
import { firebaseMaterialCommandTransport } from './firebaseMaterialCommandClient'

export const firebasePlanApprovalClient = createPlanApprovalClient({
  isOnline: () => navigator.onLine,
  transport: firebaseMaterialCommandTransport,
})
