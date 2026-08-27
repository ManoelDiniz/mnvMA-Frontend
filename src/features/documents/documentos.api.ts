import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, query } from '@/shared/api/client'
import type { Pagina } from '@/shared/api/types'

export type TipoDocumento =
  | 'RG'
  | 'CPF'
  | 'CNH'
  | 'COREN'
  | 'PROOF_OF_ADDRESS'
  | 'COURSE_CERTIFICATE'
  | 'HEALTH_CERTIFICATE'
  | 'CRIMINAL_RECORD'
  | 'VACCINATION'
  | 'CONTRACT'
  | 'OTHER'

/** Situação DERIVADA da validade — o backend calcula, o painel só exibe. */
export type SituacaoDocumento = 'PERMANENT' | 'VALID' | 'EXPIRING' | 'EXPIRED'

export const ROTULO_TIPO: Record<TipoDocumento, string> = {
  RG: 'RG',
  CPF: 'CPF',
  CNH: 'CNH',
  COREN: 'COREN',
  PROOF_OF_ADDRESS: 'Comprovante de residência',
  COURSE_CERTIFICATE: 'Certificado de curso',
  HEALTH_CERTIFICATE: 'Atestado de saúde',
  CRIMINAL_RECORD: 'Antecedentes criminais',
  VACCINATION: 'Carteira de vacinação',
  CONTRACT: 'Contrato',
  OTHER: 'Outro',
}

/** Tipos que costumam ter validade — usados para sugerir o campo na tela. */
export const TIPOS_COM_VALIDADE: TipoDocumento[] = [
  'CNH',
  'COREN',
  'HEALTH_CERTIFICATE',
  'CRIMINAL_RECORD',
  'VACCINATION',
  'CONTRACT',
]

export const SITUACAO_DOCUMENTO: Record<
  SituacaoDocumento,
  { rotulo: string; tom: 'neutro' | 'sucesso' | 'aviso' | 'perigo' }
> = {
  PERMANENT: { rotulo: 'Sem validade', tom: 'neutro' },
  VALID: { rotulo: 'Em dia', tom: 'sucesso' },
  EXPIRING: { rotulo: 'Vencendo', tom: 'aviso' },
  EXPIRED: { rotulo: 'Vencido', tom: 'perigo' },
}

export interface Documento {
  id: string
  caregiverId: string
  caregiverName: string
  type: TipoDocumento
  /** Rótulo pronto para exibir — resolve o tipo OTHER com o `label`. */
  title: string
  label: string | null
  number: string | null
  issuedAt: string | null
  expiresAt: string | null
  fileKey: string | null
  fileName: string | null
  notes: string | null
  status: SituacaoDocumento
  /** Dias até vencer. Negativo = vencido há N dias. */
  daysToExpire: number | null
}

export interface DocumentoEntrada {
  type: TipoDocumento
  label?: string
  number?: string
  issuedAt?: string
  expiresAt?: string
  notes?: string
}

export const chavesDocumentos = {
  todos: ['documentos'] as const,
  lista: (filtro: object) => [...chavesDocumentos.todos, 'lista', filtro] as const,
  vencendo: (dias: number) => [...chavesDocumentos.todos, 'vencendo', dias] as const,
}

export function useDocumentos(
  filtro: {
    caregiverId?: string
    type?: TipoDocumento
    situation?: 'all' | 'pending' | 'expiring' | 'expired'
  } = {},
) {
  return useQuery({
    queryKey: chavesDocumentos.lista(filtro),
    queryFn: ({ signal }) =>
      api.get<Pagina<Documento>>(`/documents${query({ perPage: 100, ...filtro })}`, { signal }),
    placeholderData: (anterior) => anterior,
  })
}

/**
 * O alerta do painel. Inclui o que JÁ venceu de propósito: um atestado vencido
 * há 40 dias é mais urgente que um vencendo amanhã, e some da lista se a
 * consulta só olhar para frente.
 */
export function useDocumentosVencendo(dias = 30) {
  return useQuery({
    queryKey: chavesDocumentos.vencendo(dias),
    queryFn: ({ signal }) => api.get<Documento[]>(`/documents/expiring${query({ days: dias })}`, { signal }),
  })
}

export function useCriarDocumento() {
  const cache = useQueryClient()
  return useMutation({
    // O cuidador vai no payload, e não fixo no hook: o formulário deixa trocar
    // de cuidador antes de salvar, e um hook parametrizado obrigaria a espelhar
    // essa escolha num estado paralelo só para remontar a mutação.
    mutationFn: ({ caregiverId, dados }: { caregiverId: string; dados: DocumentoEntrada }) =>
      api.post<Documento>(`/caregivers/${caregiverId}/documents`, dados),
    onSuccess: () => cache.invalidateQueries({ queryKey: chavesDocumentos.todos }),
  })
}

export function useAtualizarDocumento() {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: ({ id, dados }: { id: string; dados: Partial<DocumentoEntrada> }) =>
      api.patch<Documento>(`/documents/${id}`, dados),
    onSuccess: () => cache.invalidateQueries({ queryKey: chavesDocumentos.todos }),
  })
}

export function useRemoverDocumento() {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/documents/${id}`),
    onSuccess: () => cache.invalidateQueries({ queryKey: chavesDocumentos.todos }),
  })
}

/** "vence em 12 dias", "vencido há 3 dias" — o texto que a operação lê. */
export function prazoEmTexto(documento: Documento): string | null {
  const dias = documento.daysToExpire
  if (dias === null) return null
  if (dias < 0) return `vencido há ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'dia' : 'dias'}`
  if (dias === 0) return 'vence hoje'
  if (dias === 1) return 'vence amanhã'
  return `vence em ${dias} dias`
}
