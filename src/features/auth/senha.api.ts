import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '@/shared/api/client'

export interface PreviaRedefinicao {
  /** E-mail parcialmente oculto — só para a pessoa se reconhecer. */
  email: string
  name: string
  expiresAt: string
}

/**
 * Confere o link antes do formulário.
 *
 * `retry: false` de propósito: link expirado é resposta definitiva, não falha
 * de rede. Repetir só deixaria a pessoa esperando por um 400 que não muda.
 */
export function usePreviaRedefinicao(token: string | undefined) {
  return useQuery({
    queryKey: ['redefinicao-senha', token],
    queryFn: ({ signal }) => api.get<PreviaRedefinicao>(`/auth/reset-password/${token}`, { signal }),
    enabled: Boolean(token),
    retry: false,
  })
}

export function usePedirRedefinicao() {
  return useMutation({
    mutationFn: (email: string) => api.post<void>('/auth/forgot-password', { email }),
  })
}

export function useRedefinirSenha() {
  return useMutation({
    mutationFn: (dados: { token: string; password: string }) =>
      api.post<void>('/auth/reset-password', dados),
  })
}

export function useTrocarSenha() {
  return useMutation({
    mutationFn: (dados: { currentPassword: string; password: string }) =>
      api.post<void>('/auth/change-password', dados),
  })
}
