import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertTriangle, Download, FilePlus, Paperclip, Trash2, Upload } from 'lucide-react'
import { useAuth } from '@/features/auth/auth.store'
import { useCaregivers } from '@/features/caregivers/cuidadores.api'
import { ApiError } from '@/shared/api/client'
import { cn } from '@/shared/lib/cn'
import { formatarData } from '@/shared/lib/format'
import { Button } from '@/shared/ui/Button'
import { Badge, Card, CardBody, CardHeader } from '@/shared/ui/Card'
import { InputField, TextareaField } from '@/shared/ui/Field'
import { Selecao } from '@/shared/ui/Selecao'
import { EstadoErro, EstadoVazio, ListaSkeleton, SemPermissao } from '@/shared/ui/feedback'
import {
  ACCEPT_ARQUIVO,
  ROTULO_TIPO,
  SITUACAO_DOCUMENTO,
  TIPOS_COM_VALIDADE,
  prazoEmTexto,
  problemaNoArquivo,
  tamanhoEmTexto,
  useAnexarArquivo,
  useAtualizarDocumento,
  useBaixarArquivo,
  useCriarDocumento,
  useDocumentos,
  useRemoverArquivo,
  useRemoverDocumento,
  type Documento,
  type TipoDocumento,
} from './documentos.api'

const TIPOS = Object.keys(ROTULO_TIPO) as TipoDocumento[]

const esquema = z
  .object({
    caregiverId: z.string().min(1, 'Escolha o cuidador'),
    type: z.enum(TIPOS as [TipoDocumento, ...TipoDocumento[]]),
    label: z.string().trim().max(120).optional(),
    number: z.string().trim().max(60).optional(),
    issuedAt: z.string().optional(),
    expiresAt: z.string().optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine((d) => d.type !== 'OTHER' || Boolean(d.label?.trim()), {
    path: ['label'],
    message: 'Diga que documento é este',
  })
  .refine((d) => !d.issuedAt || !d.expiresAt || d.expiresAt >= d.issuedAt, {
    path: ['expiresAt'],
    message: 'A validade não pode ser antes da emissão',
  })

type Formulario = z.infer<typeof esquema>

const FILTROS = [
  { valor: 'pending', rotulo: 'Precisam de atenção' },
  { valor: 'all', rotulo: 'Todos' },
  { valor: 'expiring', rotulo: 'Vencendo' },
  { valor: 'expired', rotulo: 'Vencidos' },
] as const

/**
 * Documentos da equipe.
 *
 * O que importa aqui é avisar ANTES de vencer. COREN suspenso ou atestado
 * vencido põem a empresa em risco no dia em que acontece um incidente, e
 * ninguém descobre isso abrindo pasta por pasta. Por isso a tela abre no filtro
 * "precisam de atenção", e não na lista completa.
 *
 * O arquivo é opcional e vem depois, por isso ele não está no formulário de
 * cadastro: quem está com o COREN da equipe na mão registra a validade dos
 * doze de uma vez e anexa o PDF quando tiver. Exigir o arquivo para cadastrar
 * faria a validade — que é o que dispara o alerta — deixar de ser registrada.
 */
export default function DocumentosPage() {
  const pode = useAuth((e) => e.pode)
  const somenteLeitura = useAuth((e) => e.somenteLeitura)

  const [situacao, setSituacao] = useState<(typeof FILTROS)[number]['valor']>('pending')
  const [cuidadorId, setCuidadorId] = useState('')
  const [formAberto, setFormAberto] = useState(false)

  const cuidadores = useCaregivers({ status: 'active' })
  const { data, isLoading, isError, error, refetch } = useDocumentos({
    situation: situacao,
    caregiverId: cuidadorId || undefined,
  })

  if (!pode('documents:read')) return <SemPermissao />

  const documentos = data?.data ?? []
  const podeEscrever = pode('documents:write') && !somenteLeitura()
  const vencidos = documentos.filter((d) => d.status === 'EXPIRED').length

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Documentos</h1>
          <p className="mt-0.5 text-ink-muted">
            COREN, atestado e antecedentes da equipe — com aviso antes de vencer.
          </p>
        </div>

        {podeEscrever && !formAberto && (
          <Button
            onClick={() => setFormAberto(true)}
            iconeEsquerda={<FilePlus className="size-5" aria-hidden="true" />}
            className="gap-2"
          >
            Novo documento
          </Button>
        )}
      </header>

      {vencidos > 0 && (
        <p className="flex items-start gap-2 rounded-card border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            {vencidos} {vencidos === 1 ? 'documento vencido' : 'documentos vencidos'}. Cuidador com
            documento vencido em plantão é risco trabalhista.
          </span>
        </p>
      )}

      {formAberto && podeEscrever && (
        <FormularioDocumento
          cuidadores={(cuidadores.data?.data ?? []).map((c) => ({ id: c.id, name: c.name }))}
          aoFechar={() => setFormAberto(false)}
        />
      )}

      <div className="flex flex-wrap gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por situação">
          {FILTROS.map((filtro) => (
            <button
              key={filtro.valor}
              type="button"
              onClick={() => setSituacao(filtro.valor)}
              aria-pressed={situacao === filtro.valor}
              className={cn(
                'min-h-11 rounded-xl border px-3 text-sm font-medium transition-colors',
                situacao === filtro.valor
                  ? 'border-transparent bg-brand-700 text-white dark:bg-brand-500 dark:text-brand-950'
                  : 'border-border-strong bg-surface text-ink-muted hover:bg-surface-muted',
              )}
            >
              {filtro.rotulo}
            </button>
          ))}
        </div>

        <label className="sr-only" htmlFor="filtro-cuidador">
          Filtrar por cuidador
        </label>
        <select
          id="filtro-cuidador"
          value={cuidadorId}
          onChange={(e) => setCuidadorId(e.target.value)}
          className="min-h-11 rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink"
        >
          <option value="">Todos os cuidadores</option>
          {(cuidadores.data?.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {isLoading && !data ? (
        <ListaSkeleton linhas={3} />
      ) : isError ? (
        <EstadoErro erro={error} aoTentarNovamente={() => void refetch()} />
      ) : documentos.length === 0 ? (
        <EstadoVazio
          titulo={
            situacao === 'pending' ? 'Nada vencendo por aqui' : 'Nenhum documento cadastrado'
          }
          descricao={
            situacao === 'pending'
              ? 'Nenhum documento da equipe está vencido ou perto de vencer.'
              : 'Cadastre COREN, atestado de saúde e antecedentes com a data de validade — o aviso vem sozinho.'
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {documentos.map((documento) => (
            <LinhaDocumento
              key={documento.id}
              documento={documento}
              podeEscrever={podeEscrever}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Linha ────────────────────────────────────────────────────────────────────

function LinhaDocumento({
  documento,
  podeEscrever,
}: {
  documento: Documento
  podeEscrever: boolean
}) {
  const [renovando, setRenovando] = useState(false)
  const [novaValidade, setNovaValidade] = useState(documento.expiresAt ?? '')
  const [erro, setErro] = useState<string | null>(null)

  const atualizar = useAtualizarDocumento()
  const remover = useRemoverDocumento()

  const situacao = SITUACAO_DOCUMENTO[documento.status]
  const prazo = prazoEmTexto(documento)

  return (
    <li
      className={cn(
        'rounded-card border bg-surface p-3.5',
        documento.status === 'EXPIRED' ? 'border-danger/40' : 'border-border',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-ink">{documento.title}</span>
            <Badge tom={situacao.tom}>{situacao.rotulo}</Badge>
            {documento.number && (
              <span className="tabular text-xs text-ink-subtle">nº {documento.number}</span>
            )}
          </div>

          <p className="mt-0.5 truncate text-sm text-ink-muted">{documento.caregiverName}</p>

          <p className="tabular text-sm text-ink-subtle">
            {documento.expiresAt
              ? `validade ${formatarData(documento.expiresAt)}${prazo ? ` · ${prazo}` : ''}`
              : 'sem data de validade'}
          </p>
        </div>

        {podeEscrever && (
          <div className="flex gap-1.5">
            <Button variante="ghost" tamanho="sm" onClick={() => setRenovando((v) => !v)}>
              {documento.expiresAt ? 'Renovar' : 'Definir validade'}
            </Button>
            <Button
              variante="ghost"
              tamanho="sm"
              carregando={remover.isPending}
              aria-label={`Excluir ${documento.title} de ${documento.caregiverName}`}
              onClick={() => {
                if (!window.confirm(`Excluir ${documento.title} de ${documento.caregiverName}?`)) {
                  return
                }
                remover.mutate(documento.id, {
                  onError: (e) =>
                    setErro(e instanceof ApiError ? e.message : 'Não conseguimos excluir.'),
                })
              }}
            >
              <Trash2 className="size-4 text-danger" aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>

      <ArquivoDoDocumento documento={documento} podeEscrever={podeEscrever} />

      {renovando && podeEscrever && (
        <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-border pt-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`validade-${documento.id}`} className="text-sm font-medium text-ink">
              Nova validade
            </label>
            <input
              id={`validade-${documento.id}`}
              type="date"
              value={novaValidade}
              onChange={(e) => setNovaValidade(e.target.value)}
              className="tabular min-h-12 rounded-xl border border-border-strong bg-surface px-3.5 text-base text-ink"
            />
          </div>

          <Button
            tamanho="sm"
            carregando={atualizar.isPending}
            onClick={() => {
              setErro(null)
              atualizar.mutate(
                { id: documento.id, dados: { expiresAt: novaValidade || undefined } },
                {
                  onSuccess: () => setRenovando(false),
                  onError: (e) =>
                    setErro(e instanceof ApiError ? e.message : 'Não conseguimos salvar.'),
                },
              )
            }}
          >
            Salvar
          </Button>
          <Button variante="ghost" tamanho="sm" onClick={() => setRenovando(false)}>
            Cancelar
          </Button>
        </div>
      )}

      {erro && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {erro}
        </p>
      )}
    </li>
  )
}

// ─── Arquivo ──────────────────────────────────────────────────────────────────

/**
 * Anexar, baixar e trocar o arquivo do documento.
 *
 * Fica dentro da linha, e não numa tela própria, porque anexar é sempre um
 * gesto sobre um documento que já existe: a pessoa vê "COREN vencendo" e quer
 * pôr o PDF ali, não navegar para outro lugar e procurar o registro de novo.
 *
 * O `input` de arquivo é escondido e disparado pelo botão. Não é enfeite: o
 * `input[type=file]` nativo não aceita estilo, não tem foco visível decente e
 * escreve "Nenhum arquivo selecionado" em inglês em parte dos navegadores.
 */
function ArquivoDoDocumento({
  documento,
  podeEscrever,
}: {
  documento: Documento
  podeEscrever: boolean
}) {
  const seletor = useRef<HTMLInputElement>(null)
  const [erro, setErro] = useState<string | null>(null)

  const anexar = useAnexarArquivo()
  const remover = useRemoverArquivo()
  const baixar = useBaixarArquivo()

  const temArquivo = Boolean(documento.fileName)
  const ocupado = anexar.isPending || remover.isPending || baixar.isPending

  function escolheu(evento: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0]
    // Zera o valor sempre: sem isso, escolher o MESMO arquivo de novo depois de
    // um erro não dispara `change`, e a tela fica parecendo travada.
    evento.target.value = ''
    if (!arquivo) return

    setErro(null)

    const problema = problemaNoArquivo(arquivo)
    if (problema) {
      setErro(problema)
      return
    }

    anexar.mutate(
      { id: documento.id, arquivo },
      {
        onError: (e) =>
          setErro(
            e instanceof ApiError
              ? e.message
              : 'Não conseguimos enviar o arquivo. Verifique a conexão e tente de novo.',
          ),
      },
    )
  }

  if (!temArquivo && !podeEscrever) return null

  return (
    <div className="mt-2.5 border-t border-border pt-2.5">
      <input
        ref={seletor}
        type="file"
        accept={ACCEPT_ARQUIVO}
        onChange={escolheu}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
      />

      {temArquivo ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="flex min-w-0 items-center gap-1.5 text-sm text-ink-muted">
            <Paperclip className="size-4 shrink-0 text-ink-subtle" aria-hidden="true" />
            <span className="truncate">{documento.fileName}</span>
            {documento.fileSize !== null && (
              <span className="tabular shrink-0 text-xs text-ink-subtle">
                {tamanhoEmTexto(documento.fileSize)}
              </span>
            )}
          </span>

          <div className="flex flex-wrap gap-1.5">
            <Button
              variante="ghost"
              tamanho="sm"
              carregando={baixar.isPending}
              iconeEsquerda={<Download className="size-4" aria-hidden="true" />}
              className="gap-1.5"
              aria-label={`Baixar arquivo de ${documento.title}`}
              onClick={() => {
                setErro(null)
                baixar.mutate(documento.id, {
                  onError: () =>
                    setErro('Não conseguimos gerar o link agora. Tente de novo em instantes.'),
                })
              }}
            >
              Baixar
            </Button>

            {podeEscrever && (
              <>
                <Button
                  variante="ghost"
                  tamanho="sm"
                  carregando={anexar.isPending}
                  disabled={ocupado}
                  onClick={() => seletor.current?.click()}
                >
                  Trocar
                </Button>
                <Button
                  variante="ghost"
                  tamanho="sm"
                  carregando={remover.isPending}
                  disabled={ocupado}
                  onClick={() => {
                    // O registro e a validade continuam; só o anexo sai. Vale
                    // dizer isso na pergunta, senão parece que apaga tudo.
                    if (!window.confirm('Remover o arquivo? O documento e a validade continuam.')) {
                      return
                    }
                    setErro(null)
                    remover.mutate(documento.id, {
                      onError: (e) =>
                        setErro(
                          e instanceof ApiError ? e.message : 'Não conseguimos remover o arquivo.',
                        ),
                    })
                  }}
                >
                  Remover arquivo
                </Button>
              </>
            )}
          </div>
        </div>
      ) : (
        <Button
          variante="ghost"
          tamanho="sm"
          carregando={anexar.isPending}
          iconeEsquerda={<Upload className="size-4" aria-hidden="true" />}
          className="gap-1.5"
          aria-label={`Anexar arquivo em ${documento.title} de ${documento.caregiverName}`}
          onClick={() => seletor.current?.click()}
        >
          {anexar.isPending ? 'Enviando…' : 'Anexar arquivo'}
        </Button>
      )}

      {erro && (
        <p role="alert" className="mt-1.5 text-sm text-danger">
          {erro}
        </p>
      )}
    </div>
  )
}

// ─── Formulário ───────────────────────────────────────────────────────────────

function FormularioDocumento({
  cuidadores,
  aoFechar,
}: {
  cuidadores: Array<{ id: string; name: string }>
  aoFechar: () => void
}) {
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const criar = useCriarDocumento()

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: {
      caregiverId: '',
      type: 'COREN',
      label: '',
      number: '',
      issuedAt: '',
      expiresAt: '',
      notes: '',
    },
  })

  const tipo = watch('type')

  async function enviar(dados: Formulario) {
    setErroGeral(null)
    try {
      await criar.mutateAsync({
        caregiverId: dados.caregiverId,
        dados: {
          type: dados.type,
          label: dados.label || undefined,
          number: dados.number || undefined,
          issuedAt: dados.issuedAt || undefined,
          expiresAt: dados.expiresAt || undefined,
          notes: dados.notes || undefined,
        },
      })
      aoFechar()
    } catch (erro) {
      if (erro instanceof ApiError && erro.fields) {
        for (const [campo, mensagem] of Object.entries(erro.fields)) {
          setError(campo as keyof Formulario, { message: mensagem })
        }
        return
      }
      setErroGeral(
        erro instanceof ApiError ? erro.message : 'Não conseguimos salvar o documento agora.',
      )
    }
  }

  return (
    <Card>
      <CardHeader
        titulo="Novo documento"
        descricao="Registre a validade primeiro — é ela que dispara o aviso. O arquivo você anexa depois, na linha do documento."
      />
      <CardBody className="pt-3">
        <form
          onSubmit={(e) => void handleSubmit(enviar)(e)}
          className="flex flex-col gap-4"
          noValidate
        >
          {erroGeral && (
            <p
              role="alert"
              className="rounded-xl border border-danger/30 bg-danger-soft px-3.5 py-3 text-sm text-danger"
            >
              {erroGeral}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Selecao
              label="Cuidador"
              obrigatorio
              placeholder="Escolha o cuidador"
              erro={errors.caregiverId?.message}
              opcoes={cuidadores.map((c) => ({ valor: c.id, rotulo: c.name }))}
              {...register('caregiverId')}
            />
            <Selecao
              label="Tipo"
              obrigatorio
              placeholder="Escolha o tipo"
              erro={errors.type?.message}
              opcoes={TIPOS.map((t) => ({ valor: t, rotulo: ROTULO_TIPO[t] }))}
              {...register('type')}
            />
          </div>

          {tipo === 'OTHER' && (
            <InputField
              label="Que documento é este"
              obrigatorio
              erro={errors.label?.message}
              {...register('label')}
            />
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <InputField
              label="Número / registro"
              erro={errors.number?.message}
              {...register('number')}
            />
            <InputField
              label="Emissão"
              type="date"
              erro={errors.issuedAt?.message}
              {...register('issuedAt')}
            />
            <InputField
              label="Validade"
              type="date"
              ajuda={
                TIPOS_COM_VALIDADE.includes(tipo)
                  ? 'Este tipo costuma vencer — preencha para receber o aviso.'
                  : 'Vazio = sem validade.'
              }
              erro={errors.expiresAt?.message}
              {...register('expiresAt')}
            />
          </div>

          <TextareaField
            label="Observações"
            rows={2}
            erro={errors.notes?.message}
            {...register('notes')}
          />

          <div className="flex flex-wrap gap-2">
            <Button type="submit" carregando={isSubmitting}>
              Salvar documento
            </Button>
            <Button variante="ghost" onClick={aoFechar}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}
