import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, query } from '@/shared/api/client'
import type { Pagina } from '@/shared/api/types'

export type UnidadeServico = 'PLANTAO' | 'HORA' | 'DIA'

export interface Servico {
  id: string
  name: string
  code?: string | null
  unit: UnidadeServico
  salePrice: string
  caregiverCost?: string | null
  hours?: string | null
  notes?: string | null
  isActive: boolean
  /** Calculados pelo backend — o painel nunca faz conta de dinheiro. */
  margin: string
  marginPercent: number | null
  hourlyRate: string | null
}

export interface ServicoEntrada {
  name: string
  code?: string
  unit: UnidadeServico
  salePrice: string
  caregiverCost?: string
  hours?: string
  notes?: string
}

export const ROTULO_UNIDADE: Record<UnidadeServico, string> = {
  PLANTAO: 'por plantão',
  HORA: 'por hora',
  DIA: 'por diária',
}

export const chavesServicos = {
  todos: ['servicos'] as const,
  lista: (filtro: object) => [...chavesServicos.todos, 'lista', filtro] as const,
  detalhe: (id: string) => [...chavesServicos.todos, 'detalhe', id] as const,
}

export function useServicos(filtro: { q?: string; status?: 'active' | 'inactive' | 'all' } = {}) {
  return useQuery({
    queryKey: chavesServicos.lista(filtro),
    queryFn: ({ signal }) =>
      api.get<Pagina<Servico>>(`/services${query({ perPage: 100, ...filtro })}`, { signal }),
    placeholderData: (anterior) => anterior,
  })
}

export function useServico(id: string | undefined) {
  return useQuery({
    queryKey: chavesServicos.detalhe(id ?? ''),
    queryFn: ({ signal }) => api.get<Servico>(`/services/${id}`, { signal }),
    enabled: Boolean(id),
  })
}

export function useCriarServico() {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: (dados: ServicoEntrada) => api.post<Servico>('/services', dados),
    onSuccess: () => cache.invalidateQueries({ queryKey: chavesServicos.todos }),
  })
}

export function useAtualizarServico(id: string) {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: (dados: Partial<ServicoEntrada> & { isActive?: boolean }) =>
      api.patch<Servico>(`/services/${id}`, dados),
    onSuccess: () => cache.invalidateQueries({ queryKey: chavesServicos.todos }),
  })
}

export function useRemoverServico() {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/services/${id}`),
    onSuccess: () => cache.invalidateQueries({ queryKey: chavesServicos.todos }),
  })
}
