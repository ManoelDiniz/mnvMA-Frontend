import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, query } from '@/shared/api/client'
import type { Pagina, PapelUsuario } from '@/shared/api/types'

/** Papéis que a conta pode conceder. OWNER e SUPER_ADMIN não entram na lista. */
export const PAPEIS_CONCEDIVEIS = [
  'ADMIN',
  'MANAGER',
  'COORDINATOR',
  'FINANCE',
  'CAREGIVER',
] as const

export type PapelConcedivel = (typeof PAPEIS_CONCEDIVEIS)[number]

export const ROTULO_PAPEL: Record<PapelUsuario, string> = {
  SUPER_ADMIN: 'Super admin',
  OWNER: 'Titular da conta',
  ADMIN: 'Administrador',
  MANAGER: 'Gestor',
  COORDINATOR: 'Coordenador',
  FINANCE: 'Financeiro',
  CAREGIVER: 'Cuidador',
}

/**
 * O que cada papel enxerga, em uma frase.
 *
 * Fica no painel, e não só na documentação, porque é na hora de convidar que a
 * pessoa decide — e escolher "Administrador" por não saber o que "Coordenador"
 * faz é como a maioria dos acessos excessivos nasce.
 */
export const RESUMO_PAPEL: Record<PapelConcedivel, string> = {
  ADMIN: 'Faz tudo na operação e no financeiro. Só não mexe na assinatura.',
  MANAGER: 'Opera a empresa inteira e vê os relatórios de dinheiro.',
  COORDINATOR: 'Monta escala, plantão e ocorrência. Não vê o financeiro.',
  FINANCE: 'Contas a receber, a pagar e relatórios. Não mexe na escala.',
  CAREGIVER: 'Só os próprios plantões, a própria agenda e a disponibilidade.',
}

export interface UsuarioEquipe {
  id: string
  name: string
  email: string
  role: PapelUsuario
  roleLabel: string
  caregiverId: string | null
  caregiverName: string | null
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
  /** É o próprio usuário da sessão — o painel evita que ele se derrube. */
  isSelf: boolean
}

export type SituacaoConvite = 'pending' | 'accepted' | 'expired' | 'revoked'

export interface Convite {
  id: string
  email: string
  name: string
  role: PapelUsuario
  roleLabel: string
  caregiverId: string | null
  expiresAt: string
  acceptedAt: string | null
  revokedAt: string | null
  invitedByName: string | null
  situation: SituacaoConvite
  createdAt: string
}

/**
 * O `inviteUrl` chega uma única vez, na resposta de criar ou reenviar: o
 * servidor guarda só o hash do token. Some da memória do app junto com a tela —
 * por isso a interface obriga a copiar antes de fechar.
 */
export interface ConviteCriado {
  invitation: Convite
  inviteUrl: string
  /** Se o e-mail saiu. Quando é `false`, o link acima é o único caminho. */
  emailDelivered: boolean
}

export interface PreviaConvite {
  tenantName: string
  email: string
  name: string
  role: PapelUsuario
  roleLabel: string
  expiresAt: string
}

export interface ConviteEntrada {
  email: string
  name: string
  role: PapelConcedivel
  caregiverId?: string
}

export interface UsuarioAlteracao {
  name?: string
  role?: PapelConcedivel
  caregiverId?: string | null
  isActive?: boolean
}

export const chavesEquipe = {
  todos: ['equipe'] as const,
  usuarios: (filtro: object) => [...chavesEquipe.todos, 'usuarios', filtro] as const,
  convites: (filtro: object) => [...chavesEquipe.todos, 'convites', filtro] as const,
}

export function useUsuarios(filtro: { q?: string; status?: 'all' | 'active' | 'inactive' } = {}) {
  return useQuery({
    queryKey: chavesEquipe.usuarios(filtro),
    queryFn: ({ signal }) =>
      api.get<Pagina<UsuarioEquipe>>(`/users${query({ perPage: 100, ...filtro })}`, { signal }),
    placeholderData: (anterior) => anterior,
  })
}

export function useConvites(situacao: SituacaoConvite | 'all' = 'pending') {
  return useQuery({
    queryKey: chavesEquipe.convites({ situacao }),
    queryFn: ({ signal }) =>
      api.get<Pagina<Convite>>(`/users/invites${query({ situation: situacao, perPage: 100 })}`, {
        signal,
      }),
    placeholderData: (anterior) => anterior,
  })
}

export function useConvidar() {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: (dados: ConviteEntrada) => api.post<ConviteCriado>('/users/invites', dados),
    onSuccess: () => cache.invalidateQueries({ queryKey: chavesEquipe.todos }),
  })
}

export function useReenviarConvite() {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post<ConviteCriado>(`/users/invites/${id}/resend`),
    onSuccess: () => cache.invalidateQueries({ queryKey: chavesEquipe.todos }),
  })
}

export function useCancelarConvite() {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<Convite>(`/users/invites/${id}`),
    onSuccess: () => cache.invalidateQueries({ queryKey: chavesEquipe.todos }),
  })
}

export function useAtualizarUsuario() {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: ({ id, dados }: { id: string; dados: UsuarioAlteracao }) =>
      api.patch<UsuarioEquipe>(`/users/${id}`, dados),
    onSuccess: () => cache.invalidateQueries({ queryKey: chavesEquipe.todos }),
  })
}

export function useRemoverUsuario() {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/users/${id}`),
    onSuccess: () => cache.invalidateQueries({ queryKey: chavesEquipe.todos }),
  })
}

/** Rota pública: quem abre o link do convite ainda não tem sessão. */
export function usePreviaConvite(token: string | undefined) {
  return useQuery({
    queryKey: ['convite', token],
    queryFn: ({ signal }) => api.get<PreviaConvite>(`/invites/${token}`, { signal }),
    enabled: Boolean(token),
    // Convite inválido é resposta definitiva, não falha de rede: repetir só
    // deixa a pessoa esperando por um 404 que não vai mudar.
    retry: false,
  })
}
