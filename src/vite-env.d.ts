/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the deployed API. Empty on the website, set for the Android build. */
  readonly VITE_API_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
