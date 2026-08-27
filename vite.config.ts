import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const apiOrigin = new URL(env.VITE_API_URL ?? 'http://localhost:3000/v1').origin

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        // 'prompt' e não 'autoUpdate': recarregar sozinho no meio do cadastro de
        // um cliente perde o que a pessoa digitou. Quem decide é o usuário.
        registerType: 'prompt',
        injectRegister: 'auto',
        includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon-32.png'],

        manifest: {
          id: '/',
          name: 'MNVMA Care',
          short_name: 'MNVMA',
          description:
            'Gestão de clientes, plantões, escalas e financeiro para cuidadores e empresas de cuidadores.',
          lang: 'pt-BR',
          dir: 'ltr',
          start_url: '/?source=pwa',
          scope: '/',
          display: 'standalone',
          display_override: ['window-controls-overlay', 'standalone'],
          orientation: 'portrait-primary',
          background_color: '#0B1220',
          theme_color: '#0E7490',
          categories: ['business', 'productivity', 'medical'],
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            {
              src: '/icons/maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
          shortcuts: [
            { name: 'Minha agenda', short_name: 'Agenda', url: '/agenda' },
            { name: 'Clientes', short_name: 'Clientes', url: '/clientes' },
            { name: 'A receber', short_name: 'A receber', url: '/financeiro/receber' },
          ],
        },

        workbox: {
          globPatterns: ['**/*.{js,css,html,woff2,svg,png,ico}'],
          navigateFallback: '/index.html',
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          runtimeCaching: [
            {
              // Cadastros que mudam pouco: rede primeiro, cache como rede de
              // segurança quando o sinal cai no meio da rua.
              urlPattern: ({ url, request }) =>
                url.origin === apiOrigin &&
                request.method === 'GET' &&
                /\/(customers|services|caregivers)/.test(url.pathname),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'mnvma-cadastros',
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 7 },
                cacheableResponse: { statuses: [200] },
              },
            },
            {
              // Agenda precisa abrir instantânea e revalidar em segundo plano.
              urlPattern: ({ url, request }) =>
                url.origin === apiOrigin &&
                request.method === 'GET' &&
                url.pathname.includes('/shifts'),
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'mnvma-plantoes',
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 3 },
                cacheableResponse: { statuses: [200] },
              },
            },
            // Sessão, billing e webhooks NUNCA são cacheados: dado financeiro e
            // de autenticação vindo de cache velho é pior que erro de rede.
          ],
        },

        devOptions: { enabled: false },
      }),
    ],

    // `paths` do tsconfig só resolve para o TypeScript; o bundler precisa do
    // alias declarado aqui também.
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },

    server: { port: 5173, host: true },

    build: {
      target: 'es2022',
      sourcemap: true,
      rollupOptions: {
        output: {
          // Separa o que quase nunca muda do código do produto: uma correção de
          // botão não invalida o cache do React inteiro.
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            query: ['@tanstack/react-query'],
            forms: ['react-hook-form', '@hookform/resolvers', 'zod'],
          },
        },
      },
    },
  }
})
