/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_ENVIRONMENT?: 'development' | 'beta'
  readonly VITE_FIREBASE_FUNCTIONS_EMULATOR?: 'true' | 'false'
  readonly VITE_FIREBASE_IOS_API_KEY?: string
  readonly VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN?: string
  readonly VITE_FIREBASE_NATIVE_APP_CHECK_DEBUG?: 'true' | 'false'
  readonly VITE_COMPLETED_RUN_COMMANDS_ENABLED?: 'true' | 'false'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module "virtual:internal-plan-rehearsal-rules" {
  const rulesText: string | null;
  export default rulesText;
}

declare module "virtual:internal-adaptation-rehearsal-packet" {
  const packetText: {
    readonly rulesText: string;
    readonly fixturesText: string;
  } | null;
  export default packetText;
}

declare module "virtual:internal-safety-escalation-packet" {
  const packetText: {
    readonly rulesText: string;
    readonly fixturesText: string;
  } | null;
  export default packetText;
}
