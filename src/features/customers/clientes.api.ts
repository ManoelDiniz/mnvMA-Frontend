import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, query } from '@/shared/api/client'
import type { Cliente, ClienteEntrada, Pagina } from '@/shared/api/types'

export interface FiltroClientes {
  page?: number
  perPage?: number
  q?: string
  status?: 'active' | 'inactive' | 'all'
  sort?: 'name' | '-name' | 'createdAt' | '-createdAt'
}

/** Chaves em árvore: invalidar `['clientes']` derruba lista e detalhes juntos. */
export const chavesClientes = {
  todos: ['clientes'] as const,
  lista: (filtro: FiltroClientes) => [...chavesClientes.todos, 'lista', filtro] as const,
  detalhe: (id: string) => [...chavesClientes.todos, 'detalhe', id] as const,
}

export function useClientes(filtro: FiltroClientes) {
  return useQuery({
    queryKey: chavesClientes.lista(filtro),
    queryFn: ({ signal }) =>
      api.get<Pagina<Cliente>>(`/customers${query({ ...filtro })}`, { signal }),
    // Mantém a página anterior na tela enquanto a busca digitada carrega —
    // sem isso a lista pisca a cada tecla.
    placeholderData: (anterior) => anterior,
  })
}

export function useCliente(id: string | undefined) {
  return useQuery({
    queryKey: chavesClientes.detalhe(id ?? ''),
    queryFn: ({ signal }) => api.get<Cliente>(`/customers/${id}`, { signal }),
    enabled: Boolean(id),
  })
}

export function useCriarCliente() {
  const cache = useQueryClient()

  return useMutation({
    mutationFn: (dados: ClienteEntrada) => api.post<Cliente>('/customers', dados),
    onSuccess: (cliente) => {
      cache.setQueryData(chavesClientes.detalhe(cliente.id), cliente)
      void cache.invalidateQueries({ queryKey: chavesClientes.todos })
    },
  })
}

export function useAtualizarCliente(id: string) {
  const cache = useQueryClient()

  return useMutation({
    mutationFn: (dados: Partial<ClienteEntrada>) =>
      api.patch<Cliente>(`/customers/${id}`, dados),
    onSuccess: (cliente) => {
      cache.setQueryData(chavesClientes.detalhe(id), cliente)
      void cache.invalidateQueries({ queryKey: chavesClientes.todos })
    },
  })
}

export function useRemoverCliente() {
  const cache = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/customers/${id}`),
    onSuccess: () => cache.invalidateQueries({ queryKey: chavesClientes.todos }),
  })
}
