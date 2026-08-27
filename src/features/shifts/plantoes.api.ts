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

/** Um cuidador da equipe, com o motivo de não poder cobrir este plantão. */
export interface Candidato {
  id: string
  name: string
  shiftRate?: string | null
  /** Livre de conflito e dentro da disponibilidade declarada. */
  available: boolean
  /** Por que não pode, quando `available` é falso. */
  reason: string | null
  shiftsSameDay: number
}

export interface Substituicao {
  id: string
  shiftId: string
  shiftStartsAt: string
  customerName: string
  previousCaregiverId: string | null
  previousCaregiverName: string | null
  newCaregiverId: string
  newCaregiverName: string
  reason: string
  changedByName: string | null
  createdAt: string
  /** O plantão estava descoberto: foi cobertura, não troca. */
  wasUncovered: boolean
}

export interface TrocaDeCuidador {
  caregiverId: string
  reason: string
  caregiverCost?: string
  /** Escala mesmo com bloqueio ou conflito. Fica registrado no motivo. */
  force?: boolean
}

export const chavesPlantoes = {
  todos: ['plantoes'] as const,
  lista: (filtro: FiltroPlantoes) => [...chavesPlantoes.todos, 'lista', filtro] as const,
  detalhe: (id: string) => [...chavesPlantoes.todos, 'detalhe', id] as const,
  candidatos: (id: string) => [...chavesPlantoes.todos, 'candidatos', id] as const,
  substituicoes: (id: string) => [...chavesPlantoes.todos, 'substituicoes', id] as const,
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

/**
 * Quem pode cobrir este plantão.
 *
 * Vem a equipe inteira, inclusive quem não pode — com o motivo. Sumir da lista
 * sem explicação é pior que aparecer bloqueado: quem está montando a escala
 * precisa saber se a pessoa tem outro plantão, se declarou indisponibilidade ou
 * se simplesmente foi desativada.
 */
export function useCandidatos(id: string | undefined, ativo = true) {
  return useQuery({
    queryKey: chavesPlantoes.candidatos(id ?? ''),
    queryFn: ({ signal }) => api.get<Candidato[]>(`/shifts/${id ?? ''}/candidates`, { signal }),
    enabled: Boolean(id) && ativo,
  })
}

/** O histórico de trocas do plantão — é ele que a substituição existe para gerar. */
export function useSubstituicoes(id: string | undefined) {
  return useQuery({
    queryKey: chavesPlantoes.substituicoes(id ?? ''),
    queryFn: ({ signal }) =>
      api.get<Substituicao[]>(`/shifts/${id ?? ''}/substitutions`, { signal }),
    enabled: Boolean(id),
  })
}

/**
 * Troca o cuidador do plantão.
 *
 * Diferente de editar o plantão e trocar o campo: aqui a troca fica registrada
 * com motivo e autor. É o que responde depois "quantas vezes esse plantão trocou
 * de mãos?" — pergunta que o cliente faz quando reclama de rotatividade.
 */
export function useSubstituirCuidador(id: string) {
  const cache = useQueryClient()

  return useMutation({
    mutationFn: (dados: TrocaDeCuidador) => api.post<Plantao>(`/shifts/${id}/substitute`, dados),
    onSuccess: (plantao) => {
      cache.setQueryData(chavesPlantoes.detalhe(id), plantao)
      void cache.invalidateQueries({ queryKey: chavesPlantoes.todos })
    },
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
