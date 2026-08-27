import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth.store'
import { api } from '@/shared/api/client'
import type { StatusConta, TipoConta } from '@/shared/api/types'

export type StatusAssinatura = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELED'

export type StatusCobranca =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'REFUNDED'
  | 'CHARGED_BACK'
  | 'CANCELLED'

export const ROTULO_COBRANCA: Record<StatusCobranca, string> = {
  PENDING: 'Em processamento',
  APPROVED: 'Paga',
  REJECTED: 'Recusada',
  REFUNDED: 'Estornada',
  CHARGED_BACK: 'Contestada',
  CANCELLED: 'Cancelada',
}

export interface LimitesDoPlano {
  maxCustomers: number | null
  maxCaregivers: number | null
  maxShiftsPerMonth: number | null
  maxUsers: number | null
}

export interface Plano {
  id: string
  code: string
  name: string
  description: string | null
  tenantType: TipoConta
  priceCents: number
  price: string
  interval: string
  trialDays: number
  limits: LimitesDoPlano
  features: Record<string, unknown>
  current: boolean
  /** `false` quando o uso de hoje não cabe neste plano. */
  available: boolean
  blockedReason: string | null
  checkoutAvailable: boolean
}

export interface UsoDaConta {
  customers: number
  caregivers: number
  users: number
  shiftsPerMonth: number
}

export interface Cobranca {
  id: string
  status: StatusCobranca
  amount: string
  currency: string
  paymentMethod: string | null
  statusDetail: string | null
  dueAt: string | null
  paidAt: string | null
  periodStart: string | null
  periodEnd: string | null
  createdAt: string
}

export type SituacaoDoResgate = 'PENDING' | 'ACTIVE' | 'EXHAUSTED' | 'CANCELED'

/** O que a prévia do cupom devolve, antes de a pessoa se comprometer. */
export interface PreviaDoCupom {
  code: string
  name: string
  description: string | null
  discountPercent: number
  maxInvoices: number
  /** 100%: não passa por checkout e não pede cartão. */
  courtesy: boolean
  priceCents: number
  discountedPriceCents: number
  discountedPrice: string
  totalSavingsCents: number
  summary: string
  requiresCheckout: boolean
  courtesyEndsAt: string | null
}

/** O desconto valendo hoje na conta. */
export interface DescontoAtivo {
  code: string
  discountPercent: number
  maxInvoices: number
  invoicesUsed: number
  courtesy: boolean
  status: SituacaoDoResgate
  endsAt: string | null
  summary: string
}

export interface Assinatura {
  id: string
  status: StatusAssinatura
  tenantStatus: StatusConta
  plan: Plano | null
  pendingPlan: Plano | null
  trialEndsAt: string | null
  trialDaysLeft: number
  currentPeriodEnd: string | null
  nextChargeAt: string | null
  canceledAt: string | null
  pastDueSince: string | null
  writable: boolean
  checkoutUrl: string | null
  /** A cobrança está configurada neste ambiente. */
  providerReady: boolean
  usage: UsoDaConta
  lastPayment: Cobranca | null
  discount: DescontoAtivo | null
}

export interface RespostaCheckout {
  checkoutUrl: string | null
  applied: boolean
  message: string | null
  subscriptionId: string
  status: StatusAssinatura
}

export const chavesAssinatura = {
  todas: ['assinatura'] as const,
  planos: () => ['assinatura', 'planos'] as const,
  atual: () => ['assinatura', 'atual'] as const,
  pagamentos: () => ['assinatura', 'pagamentos'] as const,
}

export function usePlanos() {
  return useQuery({
    queryKey: chavesAssinatura.planos(),
    queryFn: () => api.get<Plano[]>('/billing/plans'),
  })
}

export function useAssinatura() {
  return useQuery({
    queryKey: chavesAssinatura.atual(),
    queryFn: () => api.get<Assinatura>('/billing/subscription'),
  })
}

export function usePagamentos() {
  return useQuery({
    queryKey: chavesAssinatura.pagamentos(),
    queryFn: () => api.get<Cobranca[]>('/billing/payments'),
  })
}

/**
 * Assinar, trocar de plano ou reativar — o backend decide qual dos três é pelo
 * que a conta já tem.
 *
 * Quando volta `checkoutUrl`, quem navega é o navegador inteiro
 * (`window.location.href`), não o roteador: o destino é o Mercado Pago.
 */
export function useAssinar() {
  const cache = useQueryClient()
  const recarregarSessao = useAuth((e) => e.recarregarSessao)

  return useMutation({
    mutationFn: ({ planId, couponCode }: { planId: string; couponCode?: string }) =>
      api.post<RespostaCheckout>('/billing/subscribe', { planId, couponCode }),
    onSuccess: async (resposta) => {
      await cache.invalidateQueries({ queryKey: chavesAssinatura.todas })
      // Mudança que já valeu muda status e limites da conta; a sessão precisa
      // acompanhar para a faixa de aviso sumir sem recarregar a página.
      if (resposta.applied) await recarregarSessao()
    },
  })
}

export function useCancelarAssinatura() {
  const cache = useQueryClient()
  const recarregarSessao = useAuth((e) => e.recarregarSessao)

  return useMutation({
    mutationFn: (reason?: string) => api.post<Assinatura>('/billing/cancel', { reason }),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: chavesAssinatura.todas })
      await recarregarSessao()
    },
  })
}

/**
 * Reconsulta o provedor.
 *
 * Quem ativa a conta é o webhook, e ele pode chegar depois do usuário voltar do
 * checkout — ou se perder. Esta chamada é o que a tela de retorno usa enquanto
 * espera, e o que dá ao cliente um botão para resolver sem abrir chamado.
 */
export function useSincronizarAssinatura() {
  const cache = useQueryClient()
  const recarregarSessao = useAuth((e) => e.recarregarSessao)

  return useMutation({
    mutationFn: () => api.post<Assinatura>('/billing/sync'),
    onSuccess: async (assinatura) => {
      cache.setQueryData(chavesAssinatura.atual(), assinatura)
      await recarregarSessao()
    },
  })
}

/**
 * Confere o cupom sem gastá-lo.
 *
 * A mesma validação que o resgate faz — é isso que impede a tela de prometer um
 * desconto que a assinatura vai recusar meio segundo depois.
 */
export function usePreviaDoCupom() {
  return useMutation({
    mutationFn: ({ code, planId }: { code: string; planId: string }) =>
      api.post<PreviaDoCupom>('/billing/coupons/preview', { code, planId }),
  })
}

/**
 * Preço com desconto, em centavos.
 *
 * Percentual é conta simples, e fazê-la aqui evita uma ida ao servidor por
 * cartão de plano só para mostrar o valor. Quem decide de verdade continua
 * sendo o backend, na hora de assinar — aqui é só o que a pessoa lê.
 */
export function comDesconto(precoCentavos: number, percentual: number): number {
  if (percentual >= 100) return 0
  return Math.round((precoCentavos * (100 - percentual)) / 100)
}

/** "Até 10 cuidadores" / "Cuidadores ilimitados". */
export function descreverLimite(rotulo: string, limite: number | null): string {
  return limite === null ? `${rotulo} ilimitados` : `Até ${limite} ${rotulo.toLowerCase()}`
}

export const ROTULO_ASSINATURA: Record<StatusAssinatura, string> = {
  TRIAL: 'Em teste',
  ACTIVE: 'Ativa',
  PAST_DUE: 'Pagamento pendente',
  SUSPENDED: 'Suspensa',
  CANCELED: 'Cancelada',
}
