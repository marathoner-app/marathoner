import { firebaseCompletedRunCommandClient } from '../services/firebaseCompletedRunCommandClient'
import { BetaRunCommandRehearsal } from './BetaRunCommandRehearsal'

interface BetaRunCommandRehearsalLiveProps {
  completedRunIds: readonly string[]
}

export default function BetaRunCommandRehearsalLive({
  completedRunIds,
}: BetaRunCommandRehearsalLiveProps) {
  return (
    <BetaRunCommandRehearsal
      client={firebaseCompletedRunCommandClient}
      completedRunIds={completedRunIds}
    />
  )
}
