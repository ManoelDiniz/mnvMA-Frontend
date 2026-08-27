import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, query } from '@/shared/api/client'
import type { Pagina } from '@/shared/api/types'

export interface Cuidador {
  id: string
  name: string
  cpf?: string | null
  phone?: string | null
  email?: string | null
  birthDate?: string | null
  contractType?: string | null
  hourlyRate?: string | null
  shiftRate?: string | null
  /** Titular da conta. Na conta individual é o único cuidador. */
  isOwner: boolean
  isActive: boolean
  notes?: string | null
}

export interface CuidadorEntrada {
  name: string
  cpf?: string
  phone?: string
  email?: string
  birthDate?: string
  contractType?: string
  hourlyRate?: string
  shiftRate?: string
  notes?: string
}

export const TIPOS_CONTRATO: Record<string, string> = {
  CLT: 'CLT',
  PJ: 'PJ',
  AUTONOMO: 'Autônomo',
  DIARISTA: 'Diarista',
}

export const chavesCuidadores = {
  todos: ['cuidadores'] as const,
  lista: (filtro: object) => [...chavesCuidadores.todos, 'lista', filtro] as const,
  detalhe: (id: string) => [...chavesCuidadores.todos, 'detalhe', id] as const,
}

export function useCaregivers(
  filtro: { q?: string; status?: 'active' | 'inactive' | 'all' } = {},
) {
  return useQuery({
    queryKey: chavesCuidadores.lista(filtro),
    queryFn: ({ signal }) =>
      api.get<Pagina<Cuidador>>(`/caregivers${query({ perPage: 100, ...filtro })}`, { signal }),
    placeholderData: (anterior) => anterior,
  })
}

export function useCuidador(id: string | undefined) {
  return useQuery({
    queryKey: chavesCuidadores.detalhe(id ?? ''),
    queryFn: ({ signal }) => api.get<Cuidador>(`/caregivers/${id}`, { signal }),
    enabled: Boolean(id),
  })
}

export function useCriarCuidador() {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: (dados: CuidadorEntrada) => api.post<Cuidador>('/caregivers', dados),
    onSuccess: () => cache.invalidateQueries({ queryKey: chavesCuidadores.todos }),
  })
}

export function useAtualizarCuidador(id: string) {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: (dados: Partial<CuidadorEntrada> & { isActive?: boolean }) =>
      api.patch<Cuidador>(`/caregivers/${id}`, dados),
    onSuccess: () => cache.invalidateQueries({ queryKey: chavesCuidadores.todos }),
  })
}

export function useRemoverCuidador() {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/caregivers/${id}`),
    onSuccess: () => cache.invalidateQueries({ queryKey: chavesCuidadores.todos }),
  })
}
