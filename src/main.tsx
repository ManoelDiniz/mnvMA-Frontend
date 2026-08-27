import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { ApiError, OfflineError } from '@/shared/api/client'
import { useAuth } from '@/features/auth/auth.store'
import { useLimiteDoPlano } from '@/features/billing/limite.store'
import { AvisosPwa } from './app/AvisosPwa'
import { router } from './app/router'
import './styles/index.css'

const queryClient = new QueryClient({
  /*
   * Um lugar só para o 402.
   *
   * O limite do plano pode estourar em qualquer criação — cliente, cuidador,
   * usuário, plantão. Tratar isso formulário a formulário garantiria que um
   * deles ficasse de fora e mostrasse um erro seco onde deveria haver um
   * caminho para o upgrade. As telas continuam livres para tratar os próprios
   * erros: este gancho só reconhece o 402 e abre a caixa.
   */
  mutationCache: new MutationCache({
    onError: (erro) => {
      useLimiteDoPlano.getState().registrar(erro)
    },
  }),
  defaultOptions: {
    queries: {
      // 30s: abrir a agenda, entrar num plantão e voltar não deve refazer a
      // chamada. Mais que isso começa a mostrar dado velho como se fosse novo.
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      // Voltou o sinal? Revalida. É o caso mais comum aqui: o cuidador entra
      // no elevador, perde a rede e sai com o app aberto.
      refetchOnReconnect: true,
      retry: (tentativas, erro) => {
        // Não insistir no que não vai melhorar: 401 já foi tratado pelo client,
        // 403/404 são definitivos e offline vira mensagem, não retentativa.
        if (erro instanceof OfflineError) return false
        if (erro instanceof ApiError && erro.status < 500 && erro.status !== 408) return false
        return tentativas < 2
      },
      retryDelay: (tentativa) => Math.min(1000 * 2 ** tentativa, 8000),
    },
    mutations: {
      // Escrita nunca é repetida automaticamente: um POST reenviado sem chave
      // de idempotência cria dois clientes.
      retry: false,
    },
  },
})

// Recupera a sessão antes da primeira renderização de rota protegida. O
// roteador mostra o splash enquanto isto não resolve.
void useAuth.getState().iniciar()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <AvisosPwa />
    </QueryClientProvider>
  </StrictMode>,
)
