/**
 * Contrato com a MNVMA API.
 *
 * Enquanto o backend não expõe geração automática a partir do Swagger
 * (`openapi-typescript`), estes tipos são escritos à mão e precisam acompanhar
 * `mnvma-api/src/**\/dto`. Quando divergirem, o backend é a verdade.
 */

export type TipoConta = 'INDIVIDUAL' | 'COMPANY'

export type StatusConta =
  | 'TRIAL'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'SUSPENDED'
  | 'EXPIRED'
  | 'CANCELED'

export type PapelUsuario =
  | 'SUPER_ADMIN'
  | 'OWNER'
  | 'ADMIN'
  | 'MANAGER'
  | 'COORDINATOR'
  | 'FINANCE'
  | 'CAREGIVER'

export interface UsuarioSessao {
  id: string
  name: string
  email: string
  role: PapelUsuario
  caregiverId?: string | null
}

export interface ContaSessao {
  id: string
  name: string
  type: TipoConta
  status: StatusConta
  trialEndsAt?: string | null
  trialDaysLeft: number
}

export interface Sessao {
  accessToken: string
  expiresIn: number
  user: UsuarioSessao
  tenant: ContaSessao
  permissions: string[]
  modules: string[]
}

export interface Pagina<T> {
  data: T[]
  meta: {
    page: number
    perPage: number
    total: number
    totalPages: number
  }
}

export interface Endereco {
  street?: string
  number?: string
  complement?: string
  district?: string
  city?: string
  state?: string
  zipCode?: string
}

export interface Responsavel {
  id: string
  name: string
  relationship?: string | null
  phone?: string | null
  email?: string | null
  isPrimary: boolean
  isFinancial: boolean
  isEmergency: boolean
}

export interface Cliente {
  id: string
  name: string
  cpf?: string | null
  birthDate?: string | null
  phone?: string | null
  email?: string | null
  address?: Endereco | null
  notes?: string | null
  isActive: boolean
  responsibles?: Responsavel[]
  createdAt: string
  updatedAt: string
}

export interface ResponsavelEntrada {
  id?: string
  name: string
  relationship?: string
  phone?: string
  email?: string
  isPrimary?: boolean
  isFinancial?: boolean
  isEmergency?: boolean
}

export interface ClienteEntrada {
  name: string
  cpf?: string
  birthDate?: string
  phone?: string
  email?: string
  address?: Endereco
  notes?: string
  responsibles?: ResponsavelEntrada[]
}

/** Formato único de erro da API — `code` guia o comportamento do painel. */
export interface ErroApi {
  code: string
  message: string
  fields?: Record<string, string>
  [extra: string]: unknown
}
