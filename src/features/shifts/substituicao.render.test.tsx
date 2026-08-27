import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { SubstituirCuidador } from './SubstituirCuidador'
import { chavesPlantoes, type Plantao, type Substituicao } from './plantoes.api'

/**
 * Smoke da troca de cuidador.
 *
 * O que este teste protege são as três regras que a tela precisa acertar, e que
 * não aparecem no `tsc`: não oferecer troca em plantão concluído, chamar de
 * "cobertura" quando o plantão estava descoberto, e mostrar o histórico quando
 * ele existe — que é a razão de a substituição existir como operação própria.
 */
function renderizar(
  elemento: React.ReactElement,
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

const PLANTAO: Plantao = {
  id: 'p1',
  customerId: 'c1',
  customerName: 'Dona Marta',
  caregiverId: 'cg1',
  caregiverName: 'Joana',
  serviceId: null,
  serviceName: null,
  startsAt: '2026-09-01T10:00:00.000Z',
  endsAt: '2026-09-01T22:00:00.000Z',
  chargeAmount: '320.00',
  caregiverCost: '180.00',
  otherCosts: '0.00',
  status: 'PLANNED',
  hours: 12,
  margin: '140.00',
}

const TROCA: Substituicao = {
  id: 's1',
  shiftId: 'p1',
  shiftStartsAt: '2026-09-01T10:00:00.000Z',
  customerName: 'Dona Marta',
  previousCaregiverId: 'cg0',
  previousCaregiverName: 'Rita',
  newCaregiverId: 'cg1',
  newCaregiverName: 'Joana',
  reason: 'Rita com atestado médico',
  changedByName: 'Sirlene',
  createdAt: '2026-08-30T14:00:00.000Z',
  wasUncovered: false,
}

describe('troca de cuidador no plantão', () => {
  it('oferece a troca em plantão planejado', () => {
    const html = renderizar(<SubstituirCuidador plantao={PLANTAO} podeTrocar />)

    expect(html).toContain('Trocar cuidador')
    expect(html).toContain('A troca fica no histórico')
  })

  it('em plantão sem cuidador, o texto é de cobertura, não de troca', () => {
    const html = renderizar(
      <SubstituirCuidador
        plantao={{ ...PLANTAO, caregiverId: null, caregiverName: null }}
        podeTrocar
      />,
    )

    // A distinção não é cosmética: cobrir um buraco na escala e trocar alguém
    // que já estava lá são coisas diferentes no relatório de rotatividade.
    expect(html).toContain('Escalar cuidador')
    expect(html).toContain('está descoberto')
    expect(html).not.toContain('Trocar cuidador')
  })

  it('plantão concluído não oferece troca — o financeiro já saiu', () => {
    const html = renderizar(
      <SubstituirCuidador plantao={{ ...PLANTAO, status: 'COMPLETED' }} podeTrocar />,
    )

    expect(html).not.toContain('Trocar cuidador')
    expect(html).not.toContain('Escalar')
  })

  it('quem não pode escrever não vê a ação', () => {
    const html = renderizar(<SubstituirCuidador plantao={PLANTAO} podeTrocar={false} />)
    expect(html).not.toContain('Trocar cuidador')
  })

  it('o histórico aparece mesmo para quem não pode trocar', () => {
    const html = renderizar(
      <SubstituirCuidador plantao={{ ...PLANTAO, status: 'COMPLETED' }} podeTrocar={false} />,
      [[chavesPlantoes.substituicoes('p1'), [TROCA]]],
    )

    expect(html).toContain('Trocas deste plantão')
    expect(html).toContain('Rita')
    expect(html).toContain('Rita com atestado médico')
    expect(html).toContain('Sirlene')
  })

  it('cobertura de plantão descoberto é marcada como tal no histórico', () => {
    const html = renderizar(<SubstituirCuidador plantao={PLANTAO} podeTrocar={false} />, [
      [
        chavesPlantoes.substituicoes('p1'),
        [{ ...TROCA, previousCaregiverId: null, previousCaregiverName: null, wasUncovered: true }],
      ],
    ])

    expect(html).toContain('Cobertura')
    expect(html).toContain('assumiu um plantão que estava sem')
  })
})
