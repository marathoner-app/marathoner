/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_ENVIRONMENT?: 'development' | 'beta'
  readonly VITE_FIREBASE_FUNCTIONS_EMULATOR?: 'true' | 'false'
  readonly VITE_FIREBASE_IOS_API_KEY?: string
  readonly VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN?: string
  readonly VITE_FIREBASE_NATIVE_APP_CHECK_DEBUG?: 'true' | 'false'
  readonly VITE_LOOPS_FORM_ENDPOINT?: string
  readonly VITE_LOOPS_INTEREST_LIST_ID?: string
  readonly VITE_PROVISIONAL_PLAN_DOGFOOD?: 'true' | 'false'
  readonly VITE_CLOSED_BETA_PROVISIONAL_METHODOLOGY?: 'true' | 'false'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module "virtual:internal-plan-rehearsal-rules" {
  const rulesText: string | null;
  export default rulesText;
}

declare module "virtual:provisional-plan-dogfood-rules" {
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

declare module "virtual:closed-beta-provisional-methodology-manifest" {
  const manifestText: string | null;
  export default manifestText;
}
