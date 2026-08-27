import { describe, expect, it } from 'vitest'
import { formatarData, formatarDataCurta, formatarDinheiro, formatarHora } from './format'

/**
 * O caso que motivou estes testes: vencimento, validade de documento e a semana
 * da escala apareciam UM DIA ADIANTADOS no painel.
 *
 * `new Date('2026-08-23')` é meia-noite em UTC; exibida em America/Sao_Paulo
 * (UTC-3) ela volta para 22/08 21h. Data de calendário não é instante no tempo,
 * e tratá-la como tal erra exatamente onde dói: a data que o cliente cobra.
 */
describe('formatarData', () => {
  it('não anda para trás com data de calendário', () => {
    expect(formatarData('2026-08-23')).toBe('23/08/2026')
    expect(formatarData('2026-01-01')).toBe('01/01/2026')
    expect(formatarData('2026-12-31')).toBe('31/12/2026')
  })

  it('converte o fuso quando o valor tem hora — aí o instante é o que importa', () => {
    // 00:30 UTC do dia 24 ainda é dia 23 no Brasil.
    expect(formatarData('2026-08-24T00:30:00.000Z')).toBe('23/08/2026')
  })

  it('vale também para a data curta', () => {
    expect(formatarDataCurta('2026-08-23')).toBe('23/08')
  })

  it('vazio vira travessão, não "Invalid Date"', () => {
    expect(formatarData(null)).toBe('—')
    expect(formatarData(undefined)).toBe('—')
    expect(formatarData('')).toBe('—')
  })
})

describe('formatarHora', () => {
  it('mostra a hora local do instante', () => {
    expect(formatarHora('2026-08-24T00:30:00.000Z')).toBe('21:30')
  })
})

describe('formatarDinheiro', () => {
  // O Intl separa símbolo e número com espaço NÃO quebrável — comparar com um
  // espaço comum falha por um caractere invisível.
  const semEspaco = (valor: string) => valor.replace(/\s/g, ' ')

  it('formata a string que o backend manda, sem passar por float', () => {
    expect(semEspaco(formatarDinheiro('3200.00'))).toBe('R$ 3.200,00')
    expect(semEspaco(formatarDinheiro('0.10'))).toBe('R$ 0,10')
    expect(semEspaco(formatarDinheiro(null))).toBe('R$ 0,00')
  })
})
