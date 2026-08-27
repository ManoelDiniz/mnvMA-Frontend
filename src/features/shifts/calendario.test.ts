import { describe, expect, it } from 'vitest'
import {
  agruparPorDia,
  chaveDoDia,
  diaDaSemana,
  fimDoDia,
  gradeDoMes,
  inicioDoDia,
  mesmoMes,
  primeiroDiaDoMes,
  semanaDe,
  somarDias,
  somarMeses,
  ultimoDiaDoMes,
} from './calendario'

/**
 * O fuso é onde a agenda quebra na prática.
 *
 * O caso que importa: plantão noturno que começa às 21h de sábado em São Paulo
 * já é meia-noite de domingo em UTC. Comparar UTC direto joga esse plantão para
 * o dia errado — e plantão noturno é o mais comum do setor.
 */
describe('chaveDoDia', () => {
  it('usa o dia em São Paulo, não em UTC', () => {
    // 2026-09-26T23:00:00-03:00 = 2026-09-27T02:00:00Z
    expect(chaveDoDia('2026-09-27T02:00:00.000Z')).toBe('2026-09-26')
  })

  it('vira o dia no horário certo', () => {
    expect(chaveDoDia('2026-09-27T02:59:59.000Z')).toBe('2026-09-26')
    expect(chaveDoDia('2026-09-27T03:00:00.000Z')).toBe('2026-09-27')
  })
})

describe('inicioDoDia / fimDoDia', () => {
  it('cobre o dia inteiro no fuso local', () => {
    const inicio = inicioDoDia('2026-09-26')
    const fim = fimDoDia('2026-09-26')

    expect(inicio.toISOString()).toBe('2026-09-26T03:00:00.000Z')
    expect(fim.toISOString()).toBe('2026-09-27T02:59:59.999Z')
    expect(chaveDoDia(inicio)).toBe('2026-09-26')
    expect(chaveDoDia(fim)).toBe('2026-09-26')
  })
})

describe('diaDaSemana', () => {
  it('acerta o dia da semana', () => {
    expect(diaDaSemana('2026-09-27')).toBe(0) // domingo
    expect(diaDaSemana('2026-09-28')).toBe(1) // segunda
    expect(diaDaSemana('2026-10-03')).toBe(6) // sábado
  })
})

describe('somarDias', () => {
  it('atravessa a virada do mês', () => {
    expect(somarDias('2026-09-30', 1)).toBe('2026-10-01')
    expect(somarDias('2026-10-01', -1)).toBe('2026-09-30')
  })

  it('atravessa a virada do ano', () => {
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01')
    expect(somarDias('2027-01-01', -1)).toBe('2026-12-31')
  })

  it('lida com ano bissexto', () => {
    expect(somarDias('2028-02-28', 1)).toBe('2028-02-29')
    expect(somarDias('2028-02-29', 1)).toBe('2028-03-01')
  })
})

describe('somarMeses', () => {
  it('anda mês a mês', () => {
    expect(somarMeses('2026-09-15', 1)).toBe('2026-10-01')
    expect(somarMeses('2026-09-15', -1)).toBe('2026-08-01')
  })

  it('atravessa o ano nos dois sentidos', () => {
    expect(somarMeses('2026-12-10', 1)).toBe('2027-01-01')
    expect(somarMeses('2026-01-10', -1)).toBe('2025-12-01')
  })

  // Sem esta regra, "31 de janeiro + 1 mês" viraria 3 de março.
  it('não estoura em meses curtos', () => {
    expect(somarMeses('2026-01-31', 1)).toBe('2026-02-01')
  })
})

describe('limites do mês', () => {
  it('acha o primeiro e o último dia', () => {
    expect(primeiroDiaDoMes('2026-09-17')).toBe('2026-09-01')
    expect(ultimoDiaDoMes('2026-09-17')).toBe('2026-09-30')
    expect(ultimoDiaDoMes('2026-02-10')).toBe('2026-02-28')
    expect(ultimoDiaDoMes('2028-02-10')).toBe('2028-02-29')
  })
})

describe('gradeDoMes', () => {
  const grade = gradeDoMes('2026-09-15')

  it('tem sempre 6 semanas de 7 dias', () => {
    // Número fixo evita a grade mudar de altura ao trocar de mês.
    expect(grade).toHaveLength(42)
  })

  it('começa num domingo', () => {
    expect(diaDaSemana(grade[0])).toBe(0)
  })

  it('inclui todos os dias do mês', () => {
    const doMes = grade.filter((d) => mesmoMes(d, '2026-09-01'))
    expect(doMes).toHaveLength(30)
    expect(doMes[0]).toBe('2026-09-01')
    expect(doMes[29]).toBe('2026-09-30')
  })

  it('não tem buracos nem repetições', () => {
    expect(new Set(grade).size).toBe(42)
    for (let i = 1; i < grade.length; i++) {
      expect(somarDias(grade[i - 1], 1)).toBe(grade[i])
    }
  })
})

describe('semanaDe', () => {
  it('devolve domingo a sábado', () => {
    const semana = semanaDe('2026-09-30') // quarta-feira
    expect(semana).toHaveLength(7)
    expect(semana[0]).toBe('2026-09-27')
    expect(semana[6]).toBe('2026-10-03')
  })
})

describe('agruparPorDia', () => {
  it('agrupa pelo dia local de início', () => {
    const plantoes = [
      { id: 'a', startsAt: '2026-09-26T10:00:00.000Z' }, // 07:00 local
      { id: 'b', startsAt: '2026-09-26T22:00:00.000Z' }, // 19:00 local, mesmo dia
      { id: 'c', startsAt: '2026-09-27T02:00:00.000Z' }, // 23:00 local do dia 26
    ]

    const mapa = agruparPorDia(plantoes)

    expect(mapa.get('2026-09-26')?.map((p) => p.id)).toEqual(['a', 'b', 'c'])
    expect(mapa.has('2026-09-27')).toBe(false)
  })

  it('devolve mapa vazio para lista vazia', () => {
    expect(agruparPorDia([]).size).toBe(0)
  })
})
