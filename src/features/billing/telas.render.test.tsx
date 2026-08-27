import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it } from 'vitest'
import { ApiError, OfflineError } from '@/shared/api/client'
import { useAuth } from '@/features/auth/auth.store'
import AssinaturaPage from './AssinaturaPage'
import PlanosPage from './PlanosPage'
import RetornoPage from './RetornoPage'
import { chavesAssinatura, comDesconto, descreverLimite } from './assinatura.api'
import { ModalLimiteDoPlano } from './ModalLimiteDoPlano'
import { useLimiteDoPlano } from './limite.store'

/**
 * Smoke de renderização das telas de cobrança.
 *
 * O que este teste protege é o pior cenário possível destas três telas: ficar
 * em branco. São elas que resolvem uma conta bloqueada — se quebrarem, o
 * cliente não tem por onde pagar, e o sintoma chega como "o sistema sumiu".
 */
function renderizar(
  elemento: React.ReactElement,
  /** Respostas já no cache, para poder renderizar o estado COM dados. */
  dados: Array<[readonly unknown[], unknown]> = [],
): string {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })

  for (const [chave, valor] of dados) cache.setQueryData(chave, valor)

  return renderToString(
    <QueryClientProvider client={cache}>
      <MemoryRouter>{elemento}</MemoryRouter>
    </QueryClientProvider>,
  )
}

/** Um plano pagável, o suficiente para a tela sair do esqueleto. */
const PLANO_START = {
  id: '11111111-1111-4111-8111-111111111111',
  code: 'company_start',
  name: 'Empresarial Start',
  description: 'Até 10 cuidadores.',
  tenantType: 'COMPANY',
  priceCents: 14900,
  price: '149.00',
  interval: 'months',
  trialDays: 14,
  limits: { maxCustomers: null, maxCaregivers: 10, maxShiftsPerMonth: null, maxUsers: 5 },
  features: {},
  current: false,
  available: true,
  blockedReason: null,
  checkoutAvailable: true,
}

function comPermissoes(permissoes: string[]) {
  useAuth.setState({
    boot: 'autenticado',
    usuario: { id: 'u1', name: 'Regina', email: 'regina@teste.com', role: 'OWNER' },
    conta: { id: 't1', name: 'Cuidar Bem', type: 'COMPANY', status: 'TRIAL', trialDaysLeft: 3 },
    permissoes: new Set(permissoes),
    modulos: new Set(['billing']),
  })
}

describe('telas de cobrança', () => {
  beforeEach(() => {
    comPermissoes([])
  })

  it('barra quem não tem billing:read', () => {
    expect(renderizar(<PlanosPage />)).toContain('Você não tem acesso a esta área')
    expect(renderizar(<AssinaturaPage />)).toContain('Você não tem acesso a esta área')
  })

  it('quem só lê vê os planos, e o texto avisa que não pode contratar', () => {
    comPermissoes(['billing:read'])
    const html = renderizar(<PlanosPage />)

    expect(html).toContain('Planos')
    expect(html).toContain('cancelamento a qualquer momento')
  })

  it('a tela de assinatura abre para quem pode ler', () => {
    comPermissoes(['billing:read'])
    const html = renderizar(<AssinaturaPage />)

    expect(html).toContain('Assinatura')
    expect(html).toContain('Ver planos')
  })

  it('o retorno do checkout não promete ativação: diz que está confirmando', () => {
    comPermissoes(['billing:read'])
    const html = renderizar(<RetornoPage />)

    // Quem ativa é o webhook. Se um dia esta tela disser "pronto, ativado"
    // antes da confirmação, é sinal de que alguém inverteu a fonte da verdade.
    expect(html).toContain('Confirmando seu pagamento')
    expect(html).not.toContain('Assinatura confirmada')
  })
})

describe('limite do plano', () => {
  beforeEach(() => {
    useLimiteDoPlano.setState({ atual: null })
    comPermissoes(['billing:read'])
  })

  it('reconhece o 402 e guarda o que a caixa precisa mostrar', () => {
    const reconheceu = useLimiteDoPlano.getState().registrar(
      new ApiError(402, 'PLAN_LIMIT_REACHED', 'Seu plano permite 10 cuidadores.', undefined, {
        resource: 'caregivers',
        limit: 10,
        used: 10,
        planName: 'Empresarial Start',
      }),
    )

    expect(reconheceu).toBe(true)
    expect(useLimiteDoPlano.getState().atual).toMatchObject({
      recurso: 'caregivers',
      limite: 10,
      usado: 10,
      planoNome: 'Empresarial Start',
    })
  })

  it('ignora o que não é limite de plano — 403 e offline seguem com a tela', () => {
    const registrar = useLimiteDoPlano.getState().registrar

    expect(registrar(new ApiError(403, 'FORBIDDEN', 'Sem permissão.'))).toBe(false)
    expect(registrar(new OfflineError())).toBe(false)
    expect(useLimiteDoPlano.getState().atual).toBeNull()
  })

  it('a caixa não aparece quando não há limite estourado', () => {
    // Só o caso vazio é verificável aqui: sob `renderToString`, o zustand
    // devolve o estado INICIAL da store (é o `getServerSnapshot` do
    // `useSyncExternalStore`), então mexer nela antes de renderizar não muda o
    // HTML. O caso preenchido é coberto pela lógica da store, acima — e o
    // desenho da caixa só se vê abrindo o app de verdade.
    expect(renderizar(<ModalLimiteDoPlano />)).toBe('')
  })
})

describe('cupom na tela de planos', () => {
  beforeEach(() => {
    comPermissoes(['billing:read', 'billing:write'])
  })

  const comPlanos: Array<[readonly unknown[], unknown]> = [
    [chavesAssinatura.planos(), [PLANO_START]],
  ]

  it('quem pode contratar vê o campo de cupom', () => {
    const html = renderizar(<PlanosPage />, comPlanos)
    expect(html).toContain('Tem um cupom de desconto?')
    expect(html).toContain('Empresarial Start')
  })

  it('quem só lê não vê o campo — não teria o que fazer com ele', () => {
    comPermissoes(['billing:read'])
    const html = renderizar(<PlanosPage />, comPlanos)

    expect(html).toContain('Empresarial Start')
    expect(html).not.toContain('Tem um cupom de desconto?')
  })
})

describe('preço com desconto', () => {
  it('aplica o percentual em centavos inteiros', () => {
    expect(comDesconto(14900, 50)).toBe(7450)
    expect(comDesconto(4990, 10)).toBe(4491)
  })

  it('arredonda o centavo, sem dízima', () => {
    expect(comDesconto(4990, 33)).toBe(3343)
    expect(Number.isInteger(comDesconto(4990, 33))).toBe(true)
  })

  it('100% zera: é cortesia', () => {
    expect(comDesconto(14900, 100)).toBe(0)
  })
})

describe('descrição de limite', () => {
  it('null vira "ilimitados", número vira "até N"', () => {
    expect(descreverLimite('Cuidadores', null)).toBe('Cuidadores ilimitados')
    expect(descreverLimite('Cuidadores', 10)).toBe('Até 10 cuidadores')
  })
})
