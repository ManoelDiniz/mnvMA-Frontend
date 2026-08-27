/**
 * Ajuda de calendário no fuso de São Paulo.
 *
 * Toda data vem do backend em UTC. Se o app comparar UTC direto, o plantão das
 * 21h de sábado (00h de domingo em UTC) aparece no domingo — e a agenda da
 * semana fica errada justamente no plantão noturno, que é o mais comum.
 *
 * A conversão acontece só aqui, na borda.
 */

const FUSO = 'America/Sao_Paulo'

const FORMATADOR_CHAVE = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Data no formato "2026-09-25", já no fuso local. */
export function chaveDoDia(data: Date | string): string {
  return FORMATADOR_CHAVE.format(new Date(data))
}

export function hojeChave(): string {
  return chaveDoDia(new Date())
}

/** Meia-noite local de uma chave "2026-09-25", como Date em UTC. */
export function inicioDoDia(chave: string): Date {
  // -03:00 é o offset atual do Brasil (sem horário de verão desde 2019). Se
  // voltar a existir, esta é a linha que precisa passar a consultar o fuso.
  return new Date(`${chave}T00:00:00-03:00`)
}

export function fimDoDia(chave: string): Date {
  return new Date(`${chave}T23:59:59.999-03:00`)
}

export function somarDias(chave: string, dias: number): string {
  const d = inicioDoDia(chave)
  d.setUTCDate(d.getUTCDate() + dias)
  return chaveDoDia(d)
}

export function somarMeses(chave: string, meses: number): string {
  const [ano, mes] = chave.split('-').map(Number)
  const total = (ano * 12 + (mes - 1)) + meses
  const novoAno = Math.floor(total / 12)
  const novoMes = (total % 12) + 1
  return `${novoAno}-${String(novoMes).padStart(2, '0')}-01`
}

export function primeiroDiaDoMes(chave: string): string {
  return `${chave.slice(0, 7)}-01`
}

export function ultimoDiaDoMes(chave: string): string {
  const [ano, mes] = chave.split('-').map(Number)
  return `${chave.slice(0, 7)}-${String(new Date(Date.UTC(ano, mes, 0)).getUTCDate()).padStart(2, '0')}`
}

/**
 * 0 = domingo … 6 = sábado, no fuso local.
 *
 * Ancorado ao MEIO-DIA local: à meia-noite, qualquer arredondamento de fuso
 * joga a data para o dia anterior e a grade inteira desanda uma casa.
 */
export function diaDaSemana(chave: string): number {
  return new Date(`${chave}T12:00:00-03:00`).getUTCDay()
}

/**
 * Grade do mês: sempre 6 semanas de 7 dias, começando no domingo.
 *
 * Número fixo de linhas evita a grade "pular" de altura ao trocar de mês —
 * mudança de layout no meio da navegação é desorientadora.
 */
export function gradeDoMes(chaveNoMes: string): string[] {
  const primeiro = primeiroDiaDoMes(chaveNoMes)
  const deslocamento = diaDaSemana(primeiro)
  const inicio = somarDias(primeiro, -deslocamento)
  return Array.from({ length: 42 }, (_, i) => somarDias(inicio, i))
}

export function semanaDe(chave: string): string[] {
  const inicio = somarDias(chave, -diaDaSemana(chave))
  return Array.from({ length: 7 }, (_, i) => somarDias(inicio, i))
}

export function mesmoMes(chave: string, referencia: string): boolean {
  return chave.slice(0, 7) === referencia.slice(0, 7)
}

const NOME_MES = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  year: 'numeric',
  timeZone: FUSO,
})

export function rotuloMes(chave: string): string {
  const texto = NOME_MES.format(inicioDoDia(chave))
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

const NOME_DIA = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  timeZone: FUSO,
})

export function rotuloDia(chave: string): string {
  return NOME_DIA.format(inicioDoDia(chave)).replace('.', '')
}

export const SIGLAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'] as const
export const NOMES_SEMANA = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
] as const

/** Agrupa plantões por dia local, contando o dia de INÍCIO de cada um. */
export function agruparPorDia<T extends { startsAt: string }>(itens: T[]): Map<string, T[]> {
  const mapa = new Map<string, T[]>()
  for (const item of itens) {
    const chave = chaveDoDia(item.startsAt)
    const lista = mapa.get(chave)
    if (lista) lista.push(item)
    else mapa.set(chave, [item])
  }
  return mapa
}
