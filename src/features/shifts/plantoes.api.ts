import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, query } from '@/shared/api/client'

export type StatusPlantao =
  | 'PLANNED'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELED'
  | 'NO_SHOW'

export interface Plantao {
  id: string
  customerId: string
  customerName: string
  caregiverId?: string | null
  caregiverName?: string | null
  serviceId?: string | null
  serviceName?: string | null
  startsAt: string
  endsAt: string
  chargeAmount: string
  caregiverCost: string
  otherCosts: string
  status: StatusPlantao
  statusReason?: string | null
  checkInAt?: string | null
  checkOutAt?: string | null
  notes?: string | null
  hours: number
  margin: string
}

export interface PlantaoEntrada {
  customerId: string
  caregiverId?: string
  serviceId?: string
  startsAt: string
  endsAt: string
  chargeAmount?: string
  caregiverCost?: string
  otherCosts?: string
  notes?: string
}

/**
 * Rótulo E cor para cada status.
 *
 * O rótulo vem sempre junto porque cor sozinha não comunica: daltonismo atinge
 * cerca de 8% dos homens, e "o plantão vermelho" não significa nada para eles.
 */
export const STATUS_PLANTAO: Record<
  StatusPlantao,
  { rotulo: string; tom: 'neutro' | 'info' | 'aviso' | 'sucesso' | 'perigo'; cor: string }
> = {
  PLANNED: { rotulo: 'Planejado', tom: 'neutro', cor: 'bg-ink-subtle' },
  CONFIRMED: { rotulo: 'Confirmado', tom: 'info', cor: 'bg-info' },
  IN_PROGRESS: { rotulo: 'Em andamento', tom: 'aviso', cor: 'bg-warning' },
  COMPLETED: { rotulo: 'Concluído', tom: 'sucesso', cor: 'bg-success' },
  CANCELED: { rotulo: 'Cancelado', tom: 'neutro', cor: 'bg-ink-subtle' },
  NO_SHOW: { rotulo: 'Falta', tom: 'perigo', cor: 'bg-danger' },
}

/** Para onde cada status pode ir — espelha a máquina de estados do backend. */
export const PROXIMOS_STATUS: Record<StatusPlantao, StatusPlantao[]> = {
  PLANNED: ['CONFIRMED', 'CANCELED', 'NO_SHOW'],
  CONFIRMED: ['IN_PROGRESS', 'COMPLETED', 'CANCELED', 'NO_SHOW'],
  IN_PROGRESS: ['COMPLETED', 'NO_SHOW'],
  COMPLETED: [],
  CANCELED: ['PLANNED'],
  NO_SHOW: ['PLANNED'],
}

export const EXIGEM_MOTIVO: StatusPlantao[] = ['CANCELED', 'NO_SHOW']

export interface FiltroPlantoes {
  from?: string
  to?: string
  customerId?: string
  caregiverId?: string
  status?: StatusPlantao
  uncovered?: boolean
}

export const chavesPlantoes = {
  todos: ['plantoes'] as const,
  lista: (filtro: FiltroPlantoes) => [...chavesPlantoes.todos, 'lista', filtro] as const,
  detalhe: (id: string) => [...chavesPlantoes.todos, 'detalhe', id] as const,
}

export function usePlantoes(filtro: FiltroPlantoes) {
  return useQuery({
    queryKey: chavesPlantoes.lista(filtro),
    queryFn: ({ signal }) => api.get<Plantao[]>(`/shifts${query({ ...filtro })}`, { signal }),
    placeholderData: (anterior) => anterior,
  })
}

export function usePlantao(id: string | undefined) {
  return useQuery({
    queryKey: chavesPlantoes.detalhe(id ?? ''),
    queryFn: ({ signal }) => api.get<Plantao>(`/shifts/${id}`, { signal }),
    enabled: Boolean(id),
  })
}

export function useCriarPlantao() {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: (dados: PlantaoEntrada) => api.post<Plantao>('/shifts', dados),
    onSuccess: () => cache.invalidateQueries({ queryKey: chavesPlantoes.todos }),
  })
}

export function useAtualizarPlantao(id: string) {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: (dados: Partial<PlantaoEntrada>) => api.patch<Plantao>(`/shifts/${id}`, dados),
    onSuccess: () => cache.invalidateQueries({ queryKey: chavesPlantoes.todos }),
  })
}

export function useMudarStatus(id: string) {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: (dados: { status: StatusPlantao; reason?: string }) =>
      api.post<Plantao>(`/shifts/${id}/status`, dados),
    onSuccess: (plantao) => {
      cache.setQueryData(chavesPlantoes.detalhe(id), plantao)
      void cache.invalidateQueries({ queryKey: chavesPlantoes.todos })
    },
  })
}

export function useRemoverPlantao() {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/shifts/${id}`),
    onSuccess: () => cache.invalidateQueries({ queryKey: chavesPlantoes.todos }),
  })
}

export function useGerarEscala() {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: (dados: {
      customerId: string
      caregiverId?: string
      serviceId?: string
      fromDate: string
      toDate: string
      weekdays: number[]
      startTime: string
      endTime: string
    }) => api.post<{ criados: number; pulados: number }>('/shifts/batch', dados),
    onSuccess: () => cache.invalidateQueries({ queryKey: chavesPlantoes.todos }),
  })
}
