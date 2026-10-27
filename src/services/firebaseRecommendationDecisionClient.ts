import { firebaseMaterialCommandTransport } from './firebaseMaterialCommandClient'
import { createRecommendationDecisionClient } from './recommendationDecisionClient'

export const firebaseRecommendationDecisionClient =
  createRecommendationDecisionClient({
    isOnline: () => navigator.onLine,
    transport: firebaseMaterialCommandTransport,
  })
