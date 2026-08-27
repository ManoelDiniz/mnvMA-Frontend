import { create } from 'zustand'
import { api, aoExpirarSessao, definirAccessToken } from '@/shared/api/client'
import type { ContaSessao, Sessao, UsuarioSessao } from '@/shared/api/types'

export type EstadoBoot = 'carregando' | 'autenticado' | 'anonimo'

interface AuthState {
  boot: EstadoBoot
  usuario: UsuarioSessao | null
  conta: ContaSessao | null
  permissoes: Set<string>
  modulos: Set<string>

  iniciar: () => Promise<void>
  entrar: (email: string, senha: string) => Promise<void>
  cadastrar: (dados: DadosCadastro) => Promise<void>
  aceitarConvite: (dados: DadosAceite) => Promise<void>
  sair: () => Promise<void>
  recarregarSessao: () => Promise<void>

  pode: (permissao: string) => boolean
  temModulo: (modulo: string) => boolean
  /** Conta suspensa/expirada: leitura liberada, escrita bloqueada. */
  somenteLeitura: () => boolean
}

export interface DadosAceite {
  token: string
  password: string
  name?: string
}

export interface DadosCadastro {
  name: string
  email: string
  password: string
  accountType: 'INDIVIDUAL' | 'COMPANY'
  companyName?: string
  phone?: string
}

function aplicar(sessao: Sessao) {
  if (sessao.accessToken) definirAccessToken(sessao.accessToken)
  return {
    boot: 'autenticado' as const,
    usuario: sessao.user,
    conta: sessao.tenant,
    permissoes: new Set(sessao.permissions),
    modulos: new Set(sessao.modules),
  }
}

const ANONIMO = {
  boot: 'anonimo' as const,
  usuario: null,
  conta: null,
  permissoes: new Set<string>(),
  modulos: new Set<string>(),
}

export const useAuth = create<AuthState>((set, get) => ({
  boot: 'carregando',
  usuario: null,
  conta: null,
  permissoes: new Set(),
  modulos: new Set(),

  /**
   * Chamado uma vez no boot. Como o access token vive só em memória, abrir o
   * PWA significa começar sem token — a sessão é recuperada pelo cookie de
   * refresh. Enquanto isso o app mostra o splash, para não piscar a tela de
   * login para quem já está logado.
   */
  async iniciar() {
    try {
      const sessao = await api.post<Sessao>('/auth/refresh', undefined, { semRefresh: true })
      set(aplicar(sessao))
    } catch {
      definirAccessToken(null)
      set(ANONIMO)
    }
  },

  async entrar(email, senha) {
    const sessao = await api.post<Sessao>(
      '/auth/login',
      { email, password: senha },
      { semRefresh: true },
    )
    set(aplicar(sessao))
  },

  async cadastrar(dados) {
    const sessao = await api.post<Sessao>('/auth/register', dados, { semRefresh: true })
    set(aplicar(sessao))
  },

  /**
   * Aceitar convite é o terceiro jeito de nascer uma sessão, junto de entrar e
   * cadastrar — por isso mora aqui, e não na tela. O backend devolve a sessão
   * pronta, com o mesmo cookie de refresh do login: quem acabou de escolher a
   * senha não precisa digitá-la de novo na tela seguinte.
   */
  async aceitarConvite(dados) {
    const sessao = await api.post<Sessao>('/invites/accept', dados, { semRefresh: true })
    set(aplicar(sessao))
  },

  async sair() {
    try {
      await api.post('/auth/logout', undefined, { semRefresh: true })
    } finally {
      definirAccessToken(null)
      set(ANONIMO)
    }
  },

  /** Depois de assinar ou mudar de plano, para refletir status e permissões. */
  async recarregarSessao() {
    const sessao = await api.get<Sessao>('/auth/me')
    set((estado) => ({
      ...aplicar(sessao),
      // /auth/me não emite token novo; mantém o atual.
      boot: estado.boot === 'carregando' ? 'autenticado' : estado.boot,
    }))
  },

  pode: (permissao) => get().permissoes.has(permissao),
  temModulo: (modulo) => get().modulos.has(modulo),
  somenteLeitura: () => {
    const status = get().conta?.status
    return status === 'SUSPENDED' || status === 'EXPIRED' || status === 'CANCELED'
  },
}))

// O client avisa quando o refresh falha de vez (token revogado, sessão roubada,
// 30 dias sem usar). Aqui o estado é limpo e o roteador leva para o login.
aoExpirarSessao(() => {
  useAuth.setState(ANONIMO)
})
