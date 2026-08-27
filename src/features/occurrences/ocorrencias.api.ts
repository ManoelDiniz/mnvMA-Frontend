import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, query } from '@/shared/api/client'
import type { Pagina } from '@/shared/api/types'

export type TipoOcorrencia =
  | 'HEALTH'
  | 'FALL'
  | 'MEDICATION'
  | 'BEHAVIOR'
  | 'ABSENCE'
  | 'DELAY'
  | 'EQUIPMENT'
  | 'FAMILY'
  | 'OTHER'

export type GravidadeOcorrencia = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export const ROTULO_TIPO: Record<TipoOcorrencia, string> = {
  HEALTH: 'Saúde',
  FALL: 'Queda',
  MEDICATION: 'Medicação',
  BEHAVIOR: 'Comportamento',
  ABSENCE: 'Falta do cuidador',
  DELAY: 'Atraso',
  EQUIPMENT: 'Equipamento',
  FAMILY: 'Família',
  OTHER: 'Outro',
}

/**
 * Gravidade com rótulo e cor.
 *
 * A separação existe para a lista da coordenação não misturar "atrasou 10
 * minutos" com "foi para o pronto-socorro". `CRITICAL` é o que exige alguém
 * agora.
 */
export const GRAVIDADE: Record<
  GravidadeOcorrencia,
  { rotulo: string; tom: 'neutro' | 'info' | 'aviso' | 'perigo' }
> = {
  LOW: { rotulo: 'Leve', tom: 'neutro' },
  MEDIUM: { rotulo: 'Média', tom: 'info' },
  HIGH: { rotulo: 'Grave', tom: 'aviso' },
  CRITICAL: { rotulo: 'Crítica', tom: 'perigo' },
}

export interface Ocorrencia {
  id: string
  shiftId: string | null
  shiftStartsAt: string | null
  customerId: string
  customerName: string
  caregiverId: string | null
  caregiverName: string | null
  type: TipoOcorrencia
  severity: GravidadeOcorrencia
  occurredAt: string
  title: string
  description: string
  actionTaken: string | null
  familyNotified: boolean
  resolvedAt: string | null
  resolution: string | null
  /** Copiado no registro: quem escreveu pode sair da empresa depois. */
  reportedByName: string | null
  open: boolean
}

export interface OcorrenciaEntrada {
  shiftId?: string
  customerId?: string
  caregiverId?: string
  type: TipoOcorrencia
  severity: GravidadeOcorrencia
  occurredAt?: string
  title: string
  description: string
  actionTaken?: string
  familyNotified?: boolean
}

export interface FiltroOcorrencias {
  customerId?: string
  caregiverId?: string
  type?: TipoOcorrencia
  severity?: GravidadeOcorrencia
  situation?: 'all' | 'open' | 'resolved'
}

export const chavesOcorrencias = {
  todos: ['ocorrencias'] as const,
  lista: (filtro: FiltroOcorrencias) => [...chavesOcorrencias.todos, 'lista', filtro] as const,
  criticas: ['ocorrencias', 'criticas'] as const,
}

export function useOcorrencias(filtro: FiltroOcorrencias = {}) {
  return useQuery({
    queryKey: chavesOcorrencias.lista(filtro),
    queryFn: ({ signal }) =>
      api.get<Pagina<Ocorrencia>>(`/occurrences${query({ perPage: 100, ...filtro })}`, { signal }),
    placeholderData: (anterior) => anterior,
  })
}

/** O que a coordenação precisa ver hoje: grave ou crítica ainda em aberto. */
export function useOcorrenciasCriticas() {
  return useQuery({
    queryKey: chavesOcorrencias.criticas,
    queryFn: ({ signal }) => api.get<Ocorrencia[]>('/occurrences/open-critical', { signal }),
  })
}

export function useRegistrarOcorrencia() {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: (dados: OcorrenciaEntrada) => api.post<Ocorrencia>('/occurrences', dados),
    onSuccess: () => cache.invalidateQueries({ queryKey: chavesOcorrencias.todos }),
  })
}

export function useResolverOcorrencia() {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: ({ id, resolution }: { id: string; resolution: string }) =>
      api.post<Ocorrencia>(`/occurrences/${id}/resolve`, { resolution }),
    onSuccess: () => cache.invalidateQueries({ queryKey: chavesOcorrencias.todos }),
  })
}

export function useReabrirOcorrencia() {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post<Ocorrencia>(`/occurrences/${id}/reopen`),
    onSuccess: () => cache.invalidateQueries({ queryKey: chavesOcorrencias.todos }),
  })
}
