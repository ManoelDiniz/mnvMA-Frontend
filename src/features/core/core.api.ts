import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, query } from '@/shared/api/client'
import type { Pagina, StatusConta, TipoConta } from '@/shared/api/types'

// ─── Métricas ─────────────────────────────────────────────────────────────────

export interface Metricas {
  contas: number
  pagantes: number
  porStatus: Record<StatusConta, number>
  individuais: number
  empresas: number
  /** Já com os cupons ativos descontados. */
  mrrCents: number
  mrr: string
  inadimplentes: number
  cortesias: number
  novasNoMes: number
  canceladasNoMes: number
  testesTerminando: number
  webhooksPendentes: number
}

// ─── Contas ───────────────────────────────────────────────────────────────────

export interface ContaResumo {
  id: string
  name: string
  type: TipoConta
  status: StatusConta
  document: string | null
  trialEndsAt: string | null
  planName: string | null
  subscriptionStatus: string | null
  monthlyCents: number
  couponCode: string | null
  users: number
  ownerEmail: string | null
  createdAt: string
}

export interface AcaoAdministrativa {
  id: string
  action: string
  actionLabel: string
  actorEmail: string | null
  reason: string | null
  createdAt: string
}

export interface ContaDetalhe extends ContaResumo {
  usage: { customers: number; caregivers: number; users: number; shiftsPerMonth: number }
  currentPeriodEnd: string | null
  nextChargeAt: string | null
  pastDueSince: string | null
  canceledAt: string | null
  usuarios: Array<{
    id: string
    name: string
    email: string
    role: string
    roleLabel: string
    isActive: boolean
    lastLoginAt: string | null
  }>
  cobrancas: Array<{
    id: string
    status: string
    amount: string
    statusDetail: string | null
    paidAt: string | null
    createdAt: string
  }>
  cupons: Array<{
    code: string
    discountPercent: number
    maxInvoices: number
    invoicesUsed: number
    status: string
    endsAt: string | null
  }>
  historico: AcaoAdministrativa[]
}

export interface FiltroDeContas {
  q?: string
  status?: StatusConta | ''
  type?: TipoConta | ''
  page?: number
}

// ─── Cupons ───────────────────────────────────────────────────────────────────

export interface Cupom {
  id: string
  code: string
  name: string
  description: string | null
  discountPercent: number
  maxInvoices: number
  courtesy: boolean
  startsAt: string | null
  expiresAt: string | null
  maxRedemptions: number | null
  tenantType: TipoConta | null
  firstSubscriptionOnly: boolean
  isActive: boolean
  redemptions: number
  activeRedemptions: number
  restricted: boolean
  targetEmails: string[]
  targetTenantIds: string[]
  redeemable: boolean
  blockedReason: string | null
  createdAt: string
}

export interface ResgateDeCupom {
  id: string
  tenantId: string
  tenantName: string
  couponCode: string
  status: 'PENDING' | 'ACTIVE' | 'EXHAUSTED' | 'CANCELED'
  discountPercent: number
  maxInvoices: number
  invoicesUsed: number
  redeemedAt: string
  activatedAt: string | null
  endsAt: string | null
}

export interface NovoCupom {
  code: string
  name: string
  description?: string
  discountPercent: number
  maxInvoices?: number
  expiresAt?: string
  maxRedemptions?: number
  tenantType?: TipoConta
  firstSubscriptionOnly?: boolean
  targets?: { emails?: string[] }
}

export const ROTULO_RESGATE: Record<ResgateDeCupom['status'], string> = {
  PENDING: 'Aguardando pagamento',
  ACTIVE: 'Valendo',
  EXHAUSTED: 'Encerrado',
  CANCELED: 'Cancelado',
}

// ─── Chaves e hooks ───────────────────────────────────────────────────────────

export const chavesCore = {
  todas: ['core'] as const,
  metricas: () => ['core', 'metricas'] as const,
  contas: (filtro: FiltroDeContas) => ['core', 'contas', filtro] as const,
  conta: (id: string) => ['core', 'conta', id] as const,
  cupons: () => ['core', 'cupons'] as const,
  resgates: (id: string) => ['core', 'cupons', id, 'resgates'] as const,
}

export function useMetricas() {
  return useQuery({
    queryKey: chavesCore.metricas(),
    queryFn: () => api.get<Metricas>('/admin/metrics'),
  })
}

export function useContas(filtro: FiltroDeContas) {
  return useQuery({
    queryKey: chavesCore.contas(filtro),
    queryFn: () =>
      api.get<Pagina<ContaResumo>>(
        `/admin/tenants${query({
          q: filtro.q,
          status: filtro.status || undefined,
          type: filtro.type || undefined,
          page: filtro.page,
        })}`,
      ),
  })
}

export function useConta(id: string | undefined) {
  return useQuery({
    queryKey: chavesCore.conta(id ?? ''),
    queryFn: () => api.get<ContaDetalhe>(`/admin/tenants/${id ?? ''}`),
    enabled: Boolean(id),
  })
}

/**
 * Suspender e reativar exigem motivo — o backend recusa sem ele, e é proposital:
 * a ação sem motivo é a que ninguém consegue explicar quando o cliente liga.
 */
export function useSuspenderConta(id: string) {
  const cache = useQueryClient()

  return useMutation({
    mutationFn: (reason: string) =>
      api.post<ContaDetalhe>(`/admin/tenants/${id}/suspend`, { reason }),
    onSuccess: (conta) => {
      cache.setQueryData(chavesCore.conta(id), conta)
      void cache.invalidateQueries({ queryKey: chavesCore.todas })
    },
  })
}

export function useReativarConta(id: string) {
  const cache = useQueryClient()

  return useMutation({
    mutationFn: (reason: string) =>
      api.post<ContaDetalhe>(`/admin/tenants/${id}/reactivate`, { reason }),
    onSuccess: (conta) => {
      cache.setQueryData(chavesCore.conta(id), conta)
      void cache.invalidateQueries({ queryKey: chavesCore.todas })
    },
  })
}

export function useCupons() {
  return useQuery({
    queryKey: chavesCore.cupons(),
    queryFn: () => api.get<Cupom[]>('/admin/coupons'),
  })
}

export function useResgatesDoCupom(id: string | null) {
  return useQuery({
    queryKey: chavesCore.resgates(id ?? ''),
    queryFn: () => api.get<ResgateDeCupom[]>(`/admin/coupons/${id ?? ''}/redemptions`),
    enabled: Boolean(id),
  })
}

export function useCriarCupom() {
  const cache = useQueryClient()

  return useMutation({
    mutationFn: (dados: NovoCupom) => api.post<Cupom>('/admin/coupons', dados),
    onSuccess: () => cache.invalidateQueries({ queryKey: chavesCore.cupons() }),
  })
}

export function useDesligarCupom() {
  const cache = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => api.delete<Cupom>(`/admin/coupons/${id}`),
    onSuccess: () => cache.invalidateQueries({ queryKey: chavesCore.cupons() }),
  })
}

export function useAdicionarAlvos() {
  const cache = useQueryClient()

  return useMutation({
    mutationFn: ({ id, emails }: { id: string; emails: string[] }) =>
      api.post<Cupom>(`/admin/coupons/${id}/targets`, { emails }),
    onSuccess: () => cache.invalidateQueries({ queryKey: chavesCore.cupons() }),
  })
}

/** "50% nas 3 primeiras faturas" / "Cortesia de 2 meses". */
export function resumirCupom(cupom: Pick<Cupom, 'discountPercent' | 'maxInvoices'>): string {
  if (cupom.discountPercent >= 100) {
    return `Cortesia de ${cupom.maxInvoices} ${cupom.maxInvoices === 1 ? 'mês' : 'meses'}`
  }
  return cupom.maxInvoices === 1
    ? `${cupom.discountPercent}% na primeira fatura`
    : `${cupom.discountPercent}% nas ${cupom.maxInvoices} primeiras faturas`
}
