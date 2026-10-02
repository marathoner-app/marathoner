import type { SharedRecordProofSource } from '@marathoner/training-contract'

export function sharedRecordSourceForMode(
  mode: string,
): SharedRecordProofSource {
  return mode === 'mobile-shared-record-spike' ? 'capacitor' : 'web'
}
