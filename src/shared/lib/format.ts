/**
 * Formatação pt-BR.
 *
 * Dinheiro vem da API como string ("300.00") de propósito: converter para
 * `number` no cliente reintroduz o erro de ponto flutuante que o backend
 * evitou. Aqui só formatamos para exibir — conta nenhuma é feita no navegador.
 */

const MOEDA = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const DATA_CURTA = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  timeZone: 'America/Sao_Paulo',
})

const DATA_COMPLETA = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'America/Sao_Paulo',
})

const HORA = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
})

const SO_DATA = /^\d{4}-\d{2}-\d{2}$/

/**
 * "2026-09-25" é data de CALENDÁRIO, não instante no tempo.
 *
 * `new Date('2026-09-25')` lê meia-noite em UTC; exibida no fuso do Brasil, ela
 * volta três horas e vira 24/09. Era assim que o vencimento do contas a receber,
 * a validade do documento e a semana da escala apareciam um dia adiantados.
 *
 * Ancorar no meio-dia local mantém o dia certo em qualquer fuso do país. Valor
 * com hora (o que o backend manda como `datetime`) continua passando direto —
 * ali a conversão de fuso é justamente o que se quer.
 */
function paraInstante(valor: string | Date): Date {
  if (typeof valor === 'string' && SO_DATA.test(valor)) return new Date(`${valor}T12:00:00-03:00`)
  return new Date(valor)
}

export function formatarDinheiro(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return MOEDA.format(0)
  return MOEDA.format(typeof valor === 'number' ? valor : Number(valor))
}

/** Centavos inteiros (como o backend guarda o preço dos planos). */
export function formatarCentavos(centavos: number): string {
  return MOEDA.format(centavos / 100)
}

export function formatarData(valor: string | Date | null | undefined): string {
  if (!valor) return '—'
  return DATA_COMPLETA.format(paraInstante(valor))
}

export function formatarDataCurta(valor: string | Date | null | undefined): string {
  if (!valor) return '—'
  return DATA_CURTA.format(paraInstante(valor))
}

export function formatarHora(valor: string | Date | null | undefined): string {
  if (!valor) return '—'
  return HORA.format(new Date(valor))
}

export function formatarCpf(cpf: string | null | undefined): string {
  if (!cpf) return '—'
  const digitos = cpf.replace(/\D/g, '')
  if (digitos.length !== 11) return cpf
  return digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

export function formatarTelefone(telefone: string | null | undefined): string {
  if (!telefone) return '—'
  const d = telefone.replace(/\D/g, '')
  if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  return telefone
}

/** Máscara progressiva, para aplicar enquanto a pessoa digita. */
export function mascararCpf(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 11)
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

export function mascararTelefone(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 10) {
    return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2')
  }
  return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2')
}

export function apenasDigitos(valor: string | undefined | null): string {
  return (valor ?? '').replace(/\D/g, '')
}

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

/** "há 3 minutos" — usado no selo de dado vindo do cache offline. */
export function tempoRelativo(data: Date | string): string {
  const ms = Date.now() - new Date(data).getTime()
  const minutos = Math.floor(ms / 60_000)

  if (minutos < 1) return 'agora'
  if (minutos < 60) return `há ${minutos} min`

  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `há ${horas} h`

  const dias = Math.floor(horas / 24)
  return dias === 1 ? 'ontem' : `há ${dias} dias`
}
