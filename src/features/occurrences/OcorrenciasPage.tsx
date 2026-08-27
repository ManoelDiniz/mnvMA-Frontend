import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertTriangle, ClipboardPlus } from 'lucide-react'
import { useAuth } from '@/features/auth/auth.store'
import { useCaregivers } from '@/features/caregivers/cuidadores.api'
import { useClientes } from '@/features/customers/clientes.api'
import { ApiError } from '@/shared/api/client'
import { cn } from '@/shared/lib/cn'
import { formatarData, formatarHora } from '@/shared/lib/format'
import { Button } from '@/shared/ui/Button'
import { Badge, Card, CardBody, CardHeader } from '@/shared/ui/Card'
import { CheckboxField, InputField, TextareaField } from '@/shared/ui/Field'
import { Selecao } from '@/shared/ui/Selecao'
import { EstadoErro, EstadoVazio, ListaSkeleton, SemPermissao } from '@/shared/ui/feedback'
import {
  GRAVIDADE,
  ROTULO_TIPO,
  useOcorrencias,
  useReabrirOcorrencia,
  useRegistrarOcorrencia,
  useResolverOcorrencia,
  type GravidadeOcorrencia,
  type Ocorrencia,
  type TipoOcorrencia,
} from './ocorrencias.api'

const TIPOS = Object.keys(ROTULO_TIPO) as TipoOcorrencia[]
const GRAVIDADES = Object.keys(GRAVIDADE) as GravidadeOcorrencia[]

const esquema = z.object({
  customerId: z.string().min(1, 'Escolha o cliente'),
  caregiverId: z.string().optional(),
  type: z.enum(TIPOS as [TipoOcorrencia, ...TipoOcorrencia[]]),
  severity: z.enum(GRAVIDADES as [GravidadeOcorrencia, ...GravidadeOcorrencia[]]),
  occurredAt: z.string().optional(),
  title: z.string().trim().min(3, 'Descreva em poucas palavras').max(200),
  description: z.string().trim().min(5, 'Conte o que aconteceu').max(5000),
  actionTaken: z.string().max(5000).optional(),
  familyNotified: z.boolean(),
})

type Formulario = z.infer<typeof esquema>

const FILTROS = [
  { valor: 'open', rotulo: 'Em aberto' },
  { valor: 'all', rotulo: 'Todas' },
  { valor: 'resolved', rotulo: 'Encerradas' },
] as const

/**
 * Ocorrências — o prontuário operacional da empresa.
 *
 * Quando a família cobra ou surge questionamento trabalhista, o que existe é
 * isto. Por isso nada some daqui: encerrar um caso é registrar como foi
 * resolvido, não apagar o relato.
 */
export default function OcorrenciasPage() {
  const pode = useAuth((e) => e.pode)
  const somenteLeitura = useAuth((e) => e.somenteLeitura)

  const [situacao, setSituacao] = useState<(typeof FILTROS)[number]['valor']>('open')
  const [formAberto, setFormAberto] = useState(false)

  const { data, isLoading, isError, error, refetch } = useOcorrencias({ situation: situacao })

  if (!pode('occurrences:read')) return <SemPermissao />

  const ocorrencias = data?.data ?? []
  const podeEscrever = pode('occurrences:write') && !somenteLeitura()
  const criticas = ocorrencias.filter((o) => o.open && o.severity === 'CRITICAL').length

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Ocorrências</h1>
          <p className="mt-0.5 text-ink-muted">
            Queda, medicação, falta, reclamação — o registro que responde por você depois.
          </p>
        </div>

        {podeEscrever && !formAberto && (
          <Button
            onClick={() => setFormAberto(true)}
            iconeEsquerda={<ClipboardPlus className="size-5" aria-hidden="true" />}
            className="gap-2"
          >
            Registrar
          </Button>
        )}
      </header>

      {criticas > 0 && (
        <p className="flex items-start gap-2 rounded-card border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            {criticas} {criticas === 1 ? 'ocorrência crítica em aberto' : 'ocorrências críticas em aberto'}.
            Crítica é o que exige alguém agora.
          </span>
        </p>
      )}

      {formAberto && podeEscrever && <FormularioOcorrencia aoFechar={() => setFormAberto(false)} />}

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

      {isLoading && !data ? (
        <ListaSkeleton linhas={3} />
      ) : isError ? (
        <EstadoErro erro={error} aoTentarNovamente={() => void refetch()} />
      ) : ocorrencias.length === 0 ? (
        <EstadoVazio
          titulo={situacao === 'open' ? 'Nenhuma ocorrência em aberto' : 'Nenhuma ocorrência'}
          descricao="Registre queda, recusa de medicação, falta e reclamação da família. É o que sustenta a sua versão dos fatos meses depois."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {ocorrencias.map((ocorrencia) => (
            <CartaoOcorrencia
              key={ocorrencia.id}
              ocorrencia={ocorrencia}
              podeEscrever={podeEscrever}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Cartão ───────────────────────────────────────────────────────────────────

function CartaoOcorrencia({
  ocorrencia,
  podeEscrever,
}: {
  ocorrencia: Ocorrencia
  podeEscrever: boolean
}) {
  const [encerrando, setEncerrando] = useState(false)
  const [resolucao, setResolucao] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  const resolver = useResolverOcorrencia()
  const reabrir = useReabrirOcorrencia()

  const gravidade = GRAVIDADE[ocorrencia.severity]

  return (
    <li
      className={cn(
        'rounded-card border bg-surface p-4',
        ocorrencia.open && ocorrencia.severity === 'CRITICAL'
          ? 'border-danger/40'
          : 'border-border',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-ink">{ocorrencia.title}</span>
            <Badge tom={gravidade.tom}>{gravidade.rotulo}</Badge>
            <Badge tom="neutro">{ROTULO_TIPO[ocorrencia.type]}</Badge>
            {!ocorrencia.open && <Badge tom="sucesso">Encerrada</Badge>}
          </div>

          <p className="mt-0.5 text-sm text-ink-muted">
            {ocorrencia.customerName}
            {ocorrencia.caregiverName && ` · ${ocorrencia.caregiverName}`}
          </p>

          <p className="tabular text-sm text-ink-subtle">
            {formatarData(ocorrencia.occurredAt)} às {formatarHora(ocorrencia.occurredAt)}
            {ocorrencia.reportedByName && ` · registrado por ${ocorrencia.reportedByName}`}
          </p>
        </div>

        {podeEscrever &&
          (ocorrencia.open ? (
            <Button variante="secondary" tamanho="sm" onClick={() => setEncerrando((v) => !v)}>
              Encerrar
            </Button>
          ) : (
            <Button
              variante="ghost"
              tamanho="sm"
              carregando={reabrir.isPending}
              onClick={() => {
                setErro(null)
                reabrir.mutate(ocorrencia.id, {
                  onError: (e) =>
                    setErro(e instanceof ApiError ? e.message : 'Não conseguimos reabrir.'),
                })
              }}
            >
              Reabrir
            </Button>
          ))}
      </div>

      <p className="mt-2 whitespace-pre-line text-ink">{ocorrencia.description}</p>

      {ocorrencia.actionTaken && (
        <p className="mt-2 rounded-xl bg-surface-muted px-3 py-2 text-sm text-ink-muted">
          <span className="font-medium text-ink">O que foi feito na hora: </span>
          {ocorrencia.actionTaken}
        </p>
      )}

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <span className={ocorrencia.familyNotified ? 'text-success' : 'text-warning'}>
          {ocorrencia.familyNotified ? 'Família avisada' : 'Família ainda não avisada'}
        </span>
      </div>

      {ocorrencia.resolution && (
        <p className="mt-2 rounded-xl border border-success/30 bg-success-soft px-3 py-2 text-sm text-success">
          <span className="font-medium">Encerrada em {formatarData(ocorrencia.resolvedAt)}: </span>
          {ocorrencia.resolution}
        </p>
      )}

      {encerrando && podeEscrever && (
        <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
          <TextareaField
            label="Como o caso foi resolvido"
            rows={2}
            obrigatorio
            value={resolucao}
            onChange={(e) => setResolucao(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              tamanho="sm"
              carregando={resolver.isPending}
              disabled={resolucao.trim().length < 3}
              onClick={() => {
                setErro(null)
                resolver.mutate(
                  { id: ocorrencia.id, resolution: resolucao.trim() },
                  {
                    onSuccess: () => {
                      setEncerrando(false)
                      setResolucao('')
                    },
                    onError: (e) =>
                      setErro(e instanceof ApiError ? e.message : 'Não conseguimos encerrar.'),
                  },
                )
              }}
            >
              Encerrar caso
            </Button>
            <Button variante="ghost" tamanho="sm" onClick={() => setEncerrando(false)}>
              Cancelar
            </Button>
          </div>
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

// ─── Formulário ───────────────────────────────────────────────────────────────

function FormularioOcorrencia({ aoFechar }: { aoFechar: () => void }) {
  const [erroGeral, setErroGeral] = useState<string | null>(null)

  const registrar = useRegistrarOcorrencia()
  const clientes = useClientes({ status: 'active', perPage: 100 })
  const cuidadores = useCaregivers({ status: 'active' })

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: {
      customerId: '',
      caregiverId: '',
      type: 'HEALTH',
      severity: 'MEDIUM',
      occurredAt: '',
      title: '',
      description: '',
      actionTaken: '',
      familyNotified: false,
    },
  })

  async function enviar(dados: Formulario) {
    setErroGeral(null)
    try {
      await registrar.mutateAsync({
        customerId: dados.customerId,
        caregiverId: dados.caregiverId || undefined,
        type: dados.type,
        severity: dados.severity,
        // `datetime-local` vem sem fuso; o navegador já entrega a hora local, e
        // o backend converte para UTC.
        occurredAt: dados.occurredAt ? new Date(dados.occurredAt).toISOString() : undefined,
        title: dados.title,
        description: dados.description,
        actionTaken: dados.actionTaken || undefined,
        familyNotified: dados.familyNotified,
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
        erro instanceof ApiError ? erro.message : 'Não conseguimos registrar a ocorrência agora.',
      )
    }
  }

  return (
    <Card>
      <CardHeader
        titulo="Registrar ocorrência"
        descricao="Escreva como você contaria para a família. Quanto mais concreto, mais útil daqui a seis meses."
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
              label="Cliente"
              obrigatorio
              placeholder={clientes.isLoading ? 'Carregando…' : 'Escolha o cliente'}
              erro={errors.customerId?.message}
              opcoes={(clientes.data?.data ?? []).map((c) => ({ valor: c.id, rotulo: c.name }))}
              {...register('customerId')}
            />
            <Selecao
              label="Cuidador no plantão"
              placeholder="Ninguém / não se aplica"
              erro={errors.caregiverId?.message}
              opcoes={(cuidadores.data?.data ?? []).map((c) => ({ valor: c.id, rotulo: c.name }))}
              {...register('caregiverId')}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Selecao
              label="Tipo"
              obrigatorio
              placeholder="Escolha o tipo"
              erro={errors.type?.message}
              opcoes={TIPOS.map((t) => ({ valor: t, rotulo: ROTULO_TIPO[t] }))}
              {...register('type')}
            />
            <Selecao
              label="Gravidade"
              obrigatorio
              placeholder="Escolha a gravidade"
              ajuda="Crítica = precisa de alguém agora."
              erro={errors.severity?.message}
              opcoes={GRAVIDADES.map((g) => ({ valor: g, rotulo: GRAVIDADE[g].rotulo }))}
              {...register('severity')}
            />
            <InputField
              label="Quando aconteceu"
              type="datetime-local"
              ajuda="Vazio = agora."
              erro={errors.occurredAt?.message}
              {...register('occurredAt')}
            />
          </div>

          <InputField
            label="Resumo"
            obrigatorio
            placeholder="Queda no banheiro"
            erro={errors.title?.message}
            {...register('title')}
          />

          <TextareaField
            label="O que aconteceu"
            obrigatorio
            erro={errors.description?.message}
            {...register('description')}
          />

          <TextareaField
            label="O que foi feito na hora"
            rows={2}
            erro={errors.actionTaken?.message}
            {...register('actionTaken')}
          />

          <CheckboxField label="A família foi avisada" {...register('familyNotified')} />

          <div className="flex flex-wrap gap-2">
            <Button type="submit" carregando={isSubmitting}>
              Registrar
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
