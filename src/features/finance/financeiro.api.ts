import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, query } from '@/shared/api/client'

export type StatusRecebimento = 'FORECAST' | 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELED'
export type StatusPagamento = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELED'

export type CategoriaDespesa =
  | 'CAREGIVER'
  | 'TRANSPORT'
  | 'FOOD'
  | 'SUPPLIES'
  | 'TAXES'
  | 'RENT'
  | 'SOFTWARE'
  | 'ACCOUNTING'
  | 'MARKETING'
  | 'COURSES'
  | 'EQUIPMENT'
  | 'OTHER'

export const CATEGORIAS: Record<CategoriaDespesa, string> = {
  CAREGIVER: 'Pagamento de cuidador',
  TRANSPORT: 'Transporte',
  FOOD: 'Alimentação',
  SUPPLIES: 'Material',
  TAXES: 'Impostos',
  RENT: 'Aluguel',
  SOFTWARE: 'Sistema',
  ACCOUNTING: 'Contabilidade',
  MARKETING: 'Marketing',
  COURSES: 'Cursos',
  EQUIPMENT: 'Equipamentos',
  OTHER: 'Outros',
}

/** Um lançamento, de qualquer um dos dois lados. */
export interface Lancamento {
  id: string
  competence: string
  description: string
  amount: string
  dueDate: string
  paidAt?: string | null
  paidAmount?: string | null
  status: StatusRecebimento | StatusPagamento
  daysOverdue: number
  shiftId?: string | null
  notes?: string | null
  // a receber
  customerId?: string
  customerName?: string
  // a pagar
  caregiverId?: string | null
  caregiverName?: string | null
  supplier?: string | null
  category?: CategoriaDespesa
}

export interface Resumo {
  toReceive: string
  received: string
  overdueReceivable: string
  toPay: string
  paid: string
  overduePayable: string
  cashResult: string
  expectedResult: string
}

export interface PontoFluxo {
  period: string
  income: string
  expense: string
  balance: string
}

export const STATUS_LANCAMENTO: Record<
  string,
  { rotulo: string; tom: 'neutro' | 'info' | 'aviso' | 'sucesso' | 'perigo' }
> = {
  FORECAST: { rotulo: 'Previsto', tom: 'neutro' },
  PENDING: { rotulo: 'Em aberto', tom: 'info' },
  PAID: { rotulo: 'Quitado', tom: 'sucesso' },
  OVERDUE: { rotulo: 'Vencido', tom: 'perigo' },
  CANCELED: { rotulo: 'Cancelado', tom: 'neutro' },
}

export type LadoFinanceiro = 'receber' | 'pagar'

/** `receber` e `pagar` são simétricos — um só conjunto de hooks atende os dois. */
const recurso = (lado: LadoFinanceiro) => (lado === 'receber' ? 'receivables' : 'payables')

export interface FiltroFinanceiro {
  from?: string
  to?: string
  competence?: string
  status?: string
  customerId?: string
  caregiverId?: string
  category?: CategoriaDespesa
}

export const chavesFinanceiro = {
  todos: ['financeiro'] as const,
  lista: (lado: LadoFinanceiro, filtro: FiltroFinanceiro) =>
    [...chavesFinanceiro.todos, lado, filtro] as const,
  resumo: (from: string, to: string) => [...chavesFinanceiro.todos, 'resumo', from, to] as const,
  fluxo: (from: string, to: string, groupBy: string) =>
    [...chavesFinanceiro.todos, 'fluxo', from, to, groupBy] as const,
}

export function useLancamentos(lado: LadoFinanceiro, filtro: FiltroFinanceiro) {
  return useQuery({
    queryKey: chavesFinanceiro.lista(lado, filtro),
    queryFn: ({ signal }) =>
      api.get<Lancamento[]>(`/finance/${recurso(lado)}${query({ ...filtro })}`, { signal }),
    placeholderData: (anterior) => anterior,
  })
}

export function useResumoFinanceiro(from: string, to: string) {
  return useQuery({
    queryKey: chavesFinanceiro.resumo(from, to),
    queryFn: ({ signal }) =>
      api.get<Resumo>(`/finance/summary${query({ from, to })}`, { signal }),
  })
}

export function useFluxoCaixa(from: string, to: string, groupBy: 'day' | 'month') {
  return useQuery({
    queryKey: chavesFinanceiro.fluxo(from, to, groupBy),
    queryFn: ({ signal }) =>
      api.get<PontoFluxo[]>(`/finance/cashflow${query({ from, to, groupBy })}`, { signal }),
  })
}

export function useBaixar(lado: LadoFinanceiro) {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      paidAt,
      paidAmount,
    }: {
      id: string
      paidAt?: string
      paidAmount?: string
    }) =>
      api.post<Lancamento>(`/finance/${recurso(lado)}/${id}/settle`, { paidAt, paidAmount }),
    onSuccess: () => cache.invalidateQueries({ queryKey: chavesFinanceiro.todos }),
  })
}

export function useDesfazerBaixa(lado: LadoFinanceiro) {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.post<Lancamento>(`/finance/${recurso(lado)}/${id}/unsettle`, {}),
    onSuccess: () => cache.invalidateQueries({ queryKey: chavesFinanceiro.todos }),
  })
}

export function useCriarLancamento(lado: LadoFinanceiro) {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: (dados: Record<string, unknown>) =>
      api.post<Lancamento>(`/finance/${recurso(lado)}`, dados),
    onSuccess: () => cache.invalidateQueries({ queryKey: chavesFinanceiro.todos }),
  })
}

export function useRemoverLancamento(lado: LadoFinanceiro) {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/finance/${recurso(lado)}/${id}`),
    onSuccess: () => cache.invalidateQueries({ queryKey: chavesFinanceiro.todos }),
  })
}
