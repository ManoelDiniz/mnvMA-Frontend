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

/**
 * O que o servidor aceita receber. Espelha `TIPOS_ACEITOS` do backend, que
 * confere os primeiros bytes do arquivo — esta lista é conveniência para o
 * seletor e para dar o recado antes de gastar o upload, nunca a validação.
 */
export const TIPOS_DE_ARQUIVO = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

/** O mesmo `accept` que o backend aceita, para o seletor do sistema já filtrar. */
export const ACCEPT_ARQUIVO = '.pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*'

/** 10 MB — o mesmo teto do backend. Foto de documento pelo celular passa. */
export const TAMANHO_MAXIMO_BYTES = 10 * 1024 * 1024

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
  mimeType: string | null
  /** Bytes. */
  fileSize: number | null
  fileUploadedAt: string | null
  /**
   * Link assinado e de vida curta (5 min).
   *
   * Vem junto da lista por conveniência, mas **não se guarda**: numa tela
   * aberta há meia hora ele já expirou. Quem baixa passa por
   * `useBaixarArquivo`, que pede um link novo no momento do clique.
   */
  fileUrl: string | null
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

// ─── Arquivo ──────────────────────────────────────────────────────────────────

export function useAnexarArquivo() {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: ({ id, arquivo }: { id: string; arquivo: File }) => {
      const corpo = new FormData()
      // O nome do campo é contrato com o `FileInterceptor('file')` do backend.
      corpo.append('file', arquivo)
      return api.post<Documento>(`/documents/${id}/file`, corpo)
    },
    onSuccess: () => cache.invalidateQueries({ queryKey: chavesDocumentos.todos }),
  })
}

export function useRemoverArquivo() {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<Documento>(`/documents/${id}/file`),
    onSuccess: () => cache.invalidateQueries({ queryKey: chavesDocumentos.todos }),
  })
}

/**
 * Pede um link novo e baixa.
 *
 * O `fileUrl` da lista expira em 5 minutos, e a lista fica em cache muito mais
 * que isso — usar o link de lá daria 404 justamente para quem deixou a tela
 * aberta trabalhando. Por isso o link é buscado no clique.
 *
 * A navegação é `location.href` e não `window.open`: o servidor responde com
 * `Content-Disposition: attachment`, então o navegador baixa sem sair da
 * página — e, ao contrário do `open`, nada disso é bloqueado como popup por ter
 * acontecido depois de um `await`.
 */
export function useBaixarArquivo() {
  return useMutation({
    mutationFn: async (id: string) => {
      const atual = await api.get<Documento>(`/documents/${id}`)
      if (!atual.fileUrl) throw new Error('SEM_ARQUIVO')
      return atual.fileUrl
    },
    onSuccess: (url) => {
      window.location.href = url
    },
  })
}

/**
 * O arquivo serve? Devolve o recado, ou `null` quando está tudo certo.
 *
 * O backend confere de novo, e confere melhor — pelos bytes. Isto aqui existe
 * para não fazer alguém no 4G esperar o upload de 9 MB terminar antes de
 * descobrir que o formato não serve.
 */
export function problemaNoArquivo(arquivo: File): string | null {
  if (arquivo.size === 0) return 'Este arquivo está vazio.'

  if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
    return `O arquivo tem ${tamanhoEmTexto(arquivo.size)} e o limite é 10 MB. Se for foto, tire de novo com resolução menor.`
  }

  // Alguns Android mandam `type` vazio para arquivo vindo do gerenciador; aí a
  // extensão é o que sobra. Recusar por causa disso seria barrar upload válido,
  // e o backend ainda vai conferir os bytes.
  const tipo = arquivo.type.toLowerCase()
  const extensao = arquivo.name.split('.').pop()?.toLowerCase() ?? ''
  const extensoesAceitas = ['pdf', 'jpg', 'jpeg', 'png', 'webp']

  if (tipo && !TIPOS_DE_ARQUIVO.includes(tipo) && !extensoesAceitas.includes(extensao)) {
    return 'Aceitamos PDF, JPG, PNG ou WEBP.'
  }

  return null
}

/** "2,4 MB" — tamanho em português, para caber ao lado do nome do arquivo. */
export function tamanhoEmTexto(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
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
