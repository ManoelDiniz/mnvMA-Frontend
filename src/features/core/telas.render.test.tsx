import { renderToString } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAuth } from '@/features/auth/auth.store'
import { MENU, filtrarMenu } from '@/app/navigation'
import type { PapelUsuario } from '@/shared/api/types'
import ContaDetalhePage from './ContaDetalhePage'
import ContasPage from './ContasPage'
import CuponsPage from './CuponsPage'
import PainelPage from './PainelPage'
import { chavesCore, resumirCupom } from './core.api'

/**
 * Smoke das telas do MNVMA Core.
 *
 * O risco aqui é diferente do resto do app: uma tela em branco no Care atrapalha
 * um cuidador; uma falha no Core esconde o estado do negócio inteiro. E o menu
 * tem um teste próprio porque um item do Core aparecendo para um cliente seria
 * o convite mais direto possível para ele tentar a rota.
 */
function renderizar(
  elemento: React.ReactElement,
  dados: Array<[readonly unknown[], unknown]> = [],
  rota = '/',
): string {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })

  for (const [chave, valor] of dados) cache.setQueryData(chave, valor)

  return renderToString(
    <QueryClientProvider client={cache}>
      <MemoryRouter initialEntries={[rota]}>
        <Routes>
          <Route path="/core/contas/:id" element={elemento} />
          <Route path="*" element={elemento} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function comPapel(role: PapelUsuario) {
  useAuth.setState({
    boot: 'autenticado',
    usuario: { id: 'u1', name: 'Dona do SaaS', email: 'dona@mnvma.com.br', role },
    conta: { id: 't1', name: 'MNVMA', type: 'INDIVIDUAL', status: 'ACTIVE', trialDaysLeft: 0 },
    permissoes: new Set(['billing:read', 'billing:write', 'customers:read']),
    modulos: new Set(['billing', 'customers', 'dashboard']),
  })
}

const METRICAS = {
  contas: 42,
  pagantes: 12,
  porStatus: { TRIAL: 8, ACTIVE: 12, PAST_DUE: 2, SUSPENDED: 1, EXPIRED: 15, CANCELED: 4 },
  individuais: 30,
  empresas: 12,
  mrrCents: 178800,
  mrr: '1788.00',
  inadimplentes: 3,
  cortesias: 2,
  novasNoMes: 5,
  canceladasNoMes: 1,
  testesTerminando: 3,
  webhooksPendentes: 0,
}

const CONTA = {
  id: 'c1',
  name: 'Cuidados Bem Viver',
  type: 'COMPANY' as const,
  status: 'ACTIVE' as const,
  document: '12.345.678/0001-90',
  trialEndsAt: null,
  planName: 'Empresarial Start',
  subscriptionStatus: 'ACTIVE',
  monthlyCents: 14900,
  couponCode: null,
  users: 4,
  ownerEmail: 'sirlene@bemviver.com.br',
  createdAt: '2026-03-10T12:00:00.000Z',
}

describe('menu do Core', () => {
  it('não aparece para o titular de uma conta cliente', () => {
    const grupos = filtrarMenu(
      MENU,
      () => true,
      () => true,
      'OWNER',
    )

    expect(grupos.some((g) => g.titulo === 'MNVMA Core')).toBe(false)
    expect(JSON.stringify(grupos)).not.toContain('/core')
  })

  it('aparece para o dono do SaaS', () => {
    const grupos = filtrarMenu(
      MENU,
      () => true,
      () => true,
      'SUPER_ADMIN',
    )

    const core = grupos.find((g) => g.titulo === 'MNVMA Core')
    expect(core?.itens.map((i) => i.para)).toEqual(['/core', '/core/contas', '/core/cupons'])
  })

  it('sem papel nenhum, o Core também não aparece', () => {
    const grupos = filtrarMenu(
      MENU,
      () => true,
      () => true,
    )
    expect(grupos.some((g) => g.titulo === 'MNVMA Core')).toBe(false)
  })
})

describe('telas do Core', () => {
  beforeEach(() => {
    comPapel('SUPER_ADMIN')
  })

  it('o painel mostra receita, contas e o que está parado', () => {
    const html = renderizar(<PainelPage />, [[chavesCore.metricas(), METRICAS]])

    expect(html).toContain('MNVMA Core')
    expect(html).toContain('Receita recorrente')
    // MRR já com cupom descontado, formatado em reais.
    expect(html).toContain('1.788,00')
    expect(html).toContain('12 contas pagando')
    expect(html).toContain('Eventos parados')
  })

  it('a lista de contas mostra o titular e o valor mensal', () => {
    const html = renderizar(
      <ContasPage />,
      [
        [
          chavesCore.contas({ q: '', status: '', type: '', page: 1 }),
          { data: [CONTA], meta: { page: 1, perPage: 25, total: 1, totalPages: 1 } },
        ],
      ],
      '/core/contas',
    )

    expect(html).toContain('Cuidados Bem Viver')
    expect(html).toContain('sirlene@bemviver.com.br')
    expect(html).toContain('149,00')
  })

  it('o detalhe da conta exige motivo antes de suspender', () => {
    const detalhe = {
      ...CONTA,
      usage: { customers: 12, caregivers: 4, users: 4, shiftsPerMonth: 60 },
      currentPeriodEnd: '2026-09-10T12:00:00.000Z',
      nextChargeAt: '2026-09-10T12:00:00.000Z',
      pastDueSince: null,
      canceledAt: null,
      usuarios: [
        {
          id: 'u9',
          name: 'Sirlene',
          email: 'sirlene@bemviver.com.br',
          role: 'OWNER',
          roleLabel: 'Titular da conta',
          isActive: true,
          lastLoginAt: null,
        },
      ],
      cobrancas: [],
      cupons: [],
      historico: [],
    }

    const html = renderizar(<ContaDetalhePage />, [[chavesCore.conta('c1'), detalhe]], '/core/contas/c1')

    expect(html).toContain('Suspender conta')
    expect(html).toContain('Motivo')
    // O botão nasce desabilitado: sem motivo, a ação não sai daqui.
    expect(html).toContain('disabled')
    expect(html).toContain('Histórico administrativo')
    expect(html).toContain('Nada foi feito nesta conta até agora.')
  })

  it('a tela de cupons diz quando um cupom é nominal e quando é cortesia', () => {
    const cupons = [
      {
        id: 'k1',
        code: 'BEMVINDO50',
        name: 'Lançamento',
        description: null,
        discountPercent: 50,
        maxInvoices: 3,
        courtesy: false,
        startsAt: null,
        expiresAt: null,
        maxRedemptions: 100,
        tenantType: null,
        firstSubscriptionOnly: true,
        isActive: true,
        redemptions: 7,
        activeRedemptions: 5,
        restricted: false,
        targetEmails: [],
        targetTenantIds: [],
        redeemable: true,
        blockedReason: null,
        createdAt: '2026-08-01T12:00:00.000Z',
      },
      {
        id: 'k2',
        code: 'PARCEIRO',
        name: 'Casa parceira',
        description: null,
        discountPercent: 100,
        maxInvoices: 6,
        courtesy: true,
        startsAt: null,
        expiresAt: null,
        maxRedemptions: null,
        tenantType: null,
        firstSubscriptionOnly: false,
        isActive: false,
        redemptions: 1,
        activeRedemptions: 0,
        restricted: true,
        targetEmails: ['contato@casa.com.br'],
        targetTenantIds: [],
        redeemable: false,
        blockedReason: 'Desligado',
        createdAt: '2026-08-02T12:00:00.000Z',
      },
    ]

    const html = renderizar(<CuponsPage />, [[chavesCore.cupons(), cupons]], '/core/cupons')

    expect(html).toContain('BEMVINDO50')
    expect(html).toContain('50% nas 3 primeiras faturas')
    expect(html).toContain('Cortesia de 6 meses')
    expect(html).toContain('Nominal')
    expect(html).toContain('Desligado')
  })
})

describe('resumo do cupom', () => {
  it('descreve percentual e duração em português', () => {
    expect(resumirCupom({ discountPercent: 50, maxInvoices: 3 })).toBe(
      '50% nas 3 primeiras faturas',
    )
    expect(resumirCupom({ discountPercent: 20, maxInvoices: 1 })).toBe('20% na primeira fatura')
  })

  it('100% não é desconto: é cortesia, contada em meses', () => {
    expect(resumirCupom({ discountPercent: 100, maxInvoices: 1 })).toBe('Cortesia de 1 mês')
    expect(resumirCupom({ discountPercent: 100, maxInvoices: 6 })).toBe('Cortesia de 6 meses')
  })
})
