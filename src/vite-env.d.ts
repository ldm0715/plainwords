/// <reference types="vite/client" />

declare module "*.md?raw" {
  const content: string
  export default content
}

interface ImportMetaEnv {
  readonly VITE_LLM_BASE_URL: string
  readonly VITE_LLM_KEY: string
  readonly VITE_LLM_MODEL: string
  readonly VITE_LLM_EXTRA_HEADERS: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
