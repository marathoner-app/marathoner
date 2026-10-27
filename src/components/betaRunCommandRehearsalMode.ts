export function isBetaRunCommandRehearsalMode(mode: string): boolean {
  return mode === 'ios-development' || mode === 'ios-beta'
}
