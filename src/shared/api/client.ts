import type { ErroApi } from './types'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/v1'

/**
 * Erro de API com o `code` do backend preservado — é ele que decide se abre o
 * modal de upgrade, a tela de reativação ou só um toast.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message)
    this.name = 'ApiError'
  }

  get isValidacao(): boolean {
    return this.code === 'VALIDATION_ERROR'
  }

  get isSemSessao(): boolean {
    return this.status === 401
  }

  /** Estourou o limite do plano: o painel abre o convite ao upgrade. */
  get isLimiteDoPlano(): boolean {
    return this.status === 402
  }

  /** Conta suspensa ou trial expirado: escrita bloqueada, leitura liberada. */
  get isContaBloqueada(): boolean {
    return this.code === 'TENANT_NOT_WRITABLE'
  }

  /**
   * Cota de requisições estourada. Não é falha do servidor nem da rede — é
   * "devagar" —, e a tela precisa dizer isso com todas as letras, senão a
   * pessoa fica clicando em "tentar de novo" e só piora.
   */
  get isMuitasRequisicoes(): boolean {
    return this.status === 429
  }

  /** Segundos até liberar, do cabeçalho `Retry-After`. */
  get segundosParaTentar(): number | null {
    const valor = this.extra.retryAfter
    return typeof valor === 'number' ? valor : null
  }
}

export class OfflineError extends Error {
  constructor() {
    super('Sem conexão. Verifique a internet e tente de novo.')
    this.name = 'OfflineError'
  }
}

// ─── Sessão em memória ────────────────────────────────────────────────────────

/*
 * O access token vive só aqui, numa variável do módulo.
 *
 * Guardar JWT em localStorage é o padrão mais comum e o mais perigoso: qualquer
 * XSS lê o token e assume a sessão. Como o app manipula dado pessoal de saúde,
 * o token fica em memória e a continuidade vem do refresh em cookie httpOnly,
 * que o JavaScript não alcança.
 *
 * O preço é que ao abrir o PWA não há token — por isso o boot chama
 * `POST /auth/refresh` antes de renderizar qualquer rota protegida.
 */
let accessToken: string | null = null
let aoPerderSessao: (() => void) | null = null

export function definirAccessToken(token: string | null): void {
  accessToken = token
}

export function obterAccessToken(): string | null {
  return accessToken
}

export function aoExpirarSessao(callback: () => void): void {
  aoPerderSessao = callback
}

// ─── Refresh com fila ─────────────────────────────────────────────────────────

/*
 * Se cinco requisições levarem 401 ao mesmo tempo, precisa acontecer UM refresh,
 * não cinco. Sem esta fila, refreshes concorrentes rotacionam o token uns dos
 * outros e o backend interpreta como reuso — que é roubo de sessão — e derruba
 * o usuário legítimo.
 */
let refreshEmAndamento: Promise<boolean> | null = null

async function renovarSessao(): Promise<boolean> {
  refreshEmAndamento ??= (async () => {
    try {
      const resposta = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!resposta.ok) return false

      const sessao = (await resposta.json()) as { accessToken: string }
      accessToken = sessao.accessToken
      return true
    } catch {
      return false
    } finally {
      // Libera a próxima tentativa só depois desta resolver.
      queueMicrotask(() => {
        refreshEmAndamento = null
      })
    }
  })()

  return refreshEmAndamento
}

// ─── Requisição ───────────────────────────────────────────────────────────────

interface OpcoesRequisicao {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
  /** Não tenta renovar a sessão em 401 (usado pelas próprias rotas de auth). */
  semRefresh?: boolean
  /** Chave de idempotência para POST financeiro e de cobrança. */
  idempotencyKey?: string
}

/**
 * `FormData` sai cru e **sem** `Content-Type`.
 *
 * Quem define o cabeçalho aqui é o navegador, porque só ele sabe o `boundary`
 * que separa as partes — escrever `multipart/form-data` na mão produz um
 * cabeçalho sem boundary, e o servidor responde que não veio arquivo nenhum.
 */
function ehFormData(body: unknown): body is FormData {
  return typeof FormData !== 'undefined' && body instanceof FormData
}

async function requisicao<T>(path: string, opcoes: OpcoesRequisicao = {}): Promise<T> {
  const { method = 'GET', body, signal, semRefresh = false, idempotencyKey } = opcoes

  if (typeof navigator !== 'undefined' && !navigator.onLine && method !== 'GET') {
    // GET pode ser servido pelo service worker; escrita offline, não.
    throw new OfflineError()
  }

  const arquivo = ehFormData(body)

  const executar = async (): Promise<Response> => {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (body !== undefined && !arquivo) headers['Content-Type'] = 'application/json'
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey

    return fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      credentials: 'include',
      signal,
      body: body === undefined ? undefined : arquivo ? body : JSON.stringify(body),
    })
  }

  let resposta: Response
  try {
    resposta = await executar()
  } catch (erro) {
    if (erro instanceof DOMException && erro.name === 'AbortError') throw erro
    throw new OfflineError()
  }

  if (resposta.status === 401 && !semRefresh) {
    const renovou = await renovarSessao()
    if (renovou) {
      resposta = await executar()
    } else {
      accessToken = null
      aoPerderSessao?.()
    }
  }

  if (resposta.status === 204) return undefined as T

  const texto = await resposta.text()
  const dados: unknown = texto ? JSON.parse(texto) : null

  if (!resposta.ok) {
    const erro = (dados as { error?: ErroApi } | null)?.error
    const { code, message, fields, ...extra } = erro ?? {
      code: 'ERROR',
      message: 'Não foi possível completar a operação.',
    }

    // `Retry-After` só existe no cabeçalho; sem trazê-lo para cá a tela não tem
    // como dizer quanto falta para liberar.
    const retryAfter = Number(resposta.headers.get('retry-after'))
    if (Number.isFinite(retryAfter) && retryAfter > 0) extra.retryAfter = retryAfter

    throw new ApiError(resposta.status, code, message, fields, extra)
  }

  return dados as T
}

export const api = {
  get: <T>(path: string, opcoes?: Omit<OpcoesRequisicao, 'method' | 'body'>) =>
    requisicao<T>(path, { ...opcoes, method: 'GET' }),

  post: <T>(path: string, body?: unknown, opcoes?: Omit<OpcoesRequisicao, 'method' | 'body'>) =>
    requisicao<T>(path, { ...opcoes, method: 'POST', body }),

  patch: <T>(path: string, body?: unknown, opcoes?: Omit<OpcoesRequisicao, 'method' | 'body'>) =>
    requisicao<T>(path, { ...opcoes, method: 'PATCH', body }),

  put: <T>(path: string, body?: unknown, opcoes?: Omit<OpcoesRequisicao, 'method' | 'body'>) =>
    requisicao<T>(path, { ...opcoes, method: 'PUT', body }),

  delete: <T>(path: string, opcoes?: Omit<OpcoesRequisicao, 'method' | 'body'>) =>
    requisicao<T>(path, { ...opcoes, method: 'DELETE' }),
}

/** Monta querystring ignorando vazios — evita `?q=&status=` na URL. */
export function query(params: Record<string, string | number | boolean | undefined>): string {
  const busca = new URLSearchParams()
  for (const [chave, valor] of Object.entries(params)) {
    if (valor === undefined || valor === '') continue
    busca.set(chave, String(valor))
  }
  const s = busca.toString()
  return s ? `?${s}` : ''
}
