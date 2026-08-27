import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { chavesFinanceiro } from '@/features/finance/financeiro.api'
import { api, query } from '@/shared/api/client'
import type { Pagina } from '@/shared/api/types'

export type StatusContrato = 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'ENDED'
export type CicloCobranca = 'MONTHLY' | 'BIWEEKLY'

export const ROTULO_STATUS: Record<StatusContrato, string> = {
  DRAFT: 'Rascunho',
  ACTIVE: 'Ativo',
  SUSPENDED: 'Suspenso',
  ENDED: 'Encerrado',
}

/** O que cada situação significa para a cobrança — que é o que importa. */
export const RESUMO_STATUS: Record<StatusContrato, string> = {
  DRAFT: 'Ainda em negociação. Não gera cobrança.',
  ACTIVE: 'Valendo. Entra na rodada de cobrança do mês.',
  SUSPENDED: 'Pausado (internação, viagem). Não gera cobrança.',
  ENDED: 'Encerrado. Não volta atrás.',
}

export const ROTULO_CICLO: Record<CicloCobranca, string> = {
  MONTHLY: 'Mensal',
  BIWEEKLY: 'Quinzenal (2 cobranças por mês)',
}

export interface Contrato {
  id: string
  customerId: string
  customerName: string
  serviceId: string | null
  serviceName: string | null
  caregiverId: string | null
  caregiverName: string | null
  name: string
  code: string | null
  status: StatusContrato
  startDate: string
  endDate: string | null
  billingCycle: CicloCobranca
  amount: string
  estimatedCost: string | null
  billingDay: number
  billInArrears: boolean
  lastBilledCompetence: string | null
  statusReason: string | null
  notes: string | null
  /** Calculados pelo backend — o painel nunca faz conta de dinheiro. */
  billingsPerCompetence: number
  monthlyAmount: string
  monthlyMargin: string | null
  inForce: boolean
}

export interface ContratoEntrada {
  customerId: string
  serviceId?: string
  caregiverId?: string
  name: string
  code?: string
  startDate: string
  endDate?: string
  billingCycle?: CicloCobranca
  amount: string
  estimatedCost?: string
  billingDay?: number
  billInArrears?: boolean
  notes?: string
}

export interface CobrancaDoContrato {
  id: string
  competence: string
  description: string
  amount: string
  dueDate: string
  paidAt: string | null
  paidAmount: string | null
  status: 'FORECAST' | 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELED'
}

export interface ItemDaRodada {
  contractId: string
  contractName: string
  customerName: string
  competence: string
  dueDates: string[]
  amount: string
  result: 'created' | 'skipped'
  reason?: string
}

export interface ResultadoDaRodada {
  competence: string
  dryRun: boolean
  created: number
  skipped: number
  total: string
  items: ItemDaRodada[]
}

export const chavesContratos = {
  todos: ['contratos'] as const,
  lista: (filtro: object) => [...chavesContratos.todos, 'lista', filtro] as const,
  detalhe: (id: string) => [...chavesContratos.todos, 'detalhe', id] as const,
  cobrancas: (id: string) => [...chavesContratos.todos, 'cobrancas', id] as const,
}

export function useContratos(
  filtro: { q?: string; status?: StatusContrato; customerId?: string } = {},
) {
  return useQuery({
    queryKey: chavesContratos.lista(filtro),
    queryFn: ({ signal }) =>
      api.get<Pagina<Contrato>>(`/contracts${query({ perPage: 100, ...filtro })}`, { signal }),
    placeholderData: (anterior) => anterior,
  })
}

export function useContrato(id: string | undefined) {
  return useQuery({
    queryKey: chavesContratos.detalhe(id ?? ''),
    queryFn: ({ signal }) => api.get<Contrato>(`/contracts/${id}`, { signal }),
    enabled: Boolean(id),
  })
}

export function useCobrancasDoContrato(id: string | undefined) {
  return useQuery({
    queryKey: chavesContratos.cobrancas(id ?? ''),
    queryFn: ({ signal }) => api.get<CobrancaDoContrato[]>(`/contracts/${id}/billings`, { signal }),
    enabled: Boolean(id),
  })
}

export function useCriarContrato() {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: (dados: ContratoEntrada) => api.post<Contrato>('/contracts', dados),
    onSuccess: () => cache.invalidateQueries({ queryKey: chavesContratos.todos }),
  })
}

export function useAtualizarContrato(id: string) {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: (dados: Partial<ContratoEntrada>) => api.patch<Contrato>(`/contracts/${id}`, dados),
    onSuccess: () => cache.invalidateQueries({ queryKey: chavesContratos.todos }),
  })
}

export function useMudarStatusContrato(id: string) {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: (dados: { status: StatusContrato; reason?: string }) =>
      api.post<Contrato>(`/contracts/${id}/status`, dados),
    onSuccess: () => cache.invalidateQueries({ queryKey: chavesContratos.todos }),
  })
}

export function useRemoverContrato() {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/contracts/${id}`),
    onSuccess: () => cache.invalidateQueries({ queryKey: chavesContratos.todos }),
  })
}

/**
 * Rodada de cobrança do mês.
 *
 * `dryRun` não é detalhe técnico: disparar cobrança errada para 40 famílias é um
 * telefonema por família. A tela sempre mostra a prévia antes de gravar, e o
 * backend garante que rodar duas vezes não cobra duas vezes.
 */
export function useRodadaDeCobranca() {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: ({ competence, dryRun }: { competence: string; dryRun: boolean }) =>
      api.post<ResultadoDaRodada>('/contracts/generate-billing', { competence, dryRun }),
    onSuccess: (resultado) => {
      if (resultado.dryRun) return
      void cache.invalidateQueries({ queryKey: chavesContratos.todos })
      // A cobrança nasce no contas a receber: sem isto, o financeiro só
      // mostraria as mensalidades depois de um F5.
      void cache.invalidateQueries({ queryKey: chavesFinanceiro.todos })
    },
  })
}

/** Competência corrente no fuso de São Paulo, no formato AAAA-MM. */
export function competenciaAtual(): string {
  const agora = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  return agora.slice(0, 7)
}

export function formatarCompetencia(competencia: string): string {
  const [ano, mes] = competencia.split('-')
  return `${mes}/${ano}`
}
