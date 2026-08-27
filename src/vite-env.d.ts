/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

/**
 * Sem isto, `import.meta.env.VITE_API_URL` é `any` e o TypeScript para de
 * ajudar exatamente onde mais importa: a URL da API. Tudo opcional porque o
 * `.env` pode não existir em build de CI.
 */
interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_APP_NAME?: string
  readonly VITE_MP_PUBLIC_KEY?: string
  readonly VITE_VAPID_PUBLIC_KEY?: string
  readonly VITE_SENTRY_DSN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
