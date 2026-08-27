import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { useAuth } from '@/features/auth/auth.store'
import { useCaregivers } from '@/features/caregivers/cuidadores.api'
import { useClientes } from '@/features/customers/clientes.api'
import { useServicos } from '@/features/services/servicos.api'
import { ApiError } from '@/shared/api/client'
import { formatarData, formatarDinheiro } from '@/shared/lib/format'
import { Button } from '@/shared/ui/Button'
import { Badge, Card, CardBody, CardHeader } from '@/shared/ui/Card'
import { CheckboxField, InputField, TextareaField } from '@/shared/ui/Field'
import { Selecao } from '@/shared/ui/Selecao'
import { Carregando, SemPermissao } from '@/shared/ui/feedback'
import {
  RESUMO_STATUS,
  ROTULO_CICLO,
  ROTULO_STATUS,
  formatarCompetencia,
  useAtualizarContrato,
  useCobrancasDoContrato,
  useContrato,
  useCriarContrato,
  useMudarStatusContrato,
  useRemoverContrato,
  type StatusContrato,
} from './contratos.api'

/** "1.234,56" ou "1234.56" → "1234.56". A API só aceita ponto decimal. */
function paraDecimal(valor: string | undefined): string | undefined {
  if (!valor) return undefined
  const limpo = valor.replace(/\s/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.')
  return limpo || undefined
}

const dinheiroOpcional = z
  .string()
  .optional()
  .refine((v) => !v || !Number.isNaN(Number(paraDecimal(v))), 'Valor inválido')

const esquema = z
  .object({
    customerId: z.string().min(1, 'Escolha o cliente'),
    name: z.string().trim().min(3, 'Dê um nome ao contrato').max(160),
    code: z.string().trim().max(40).optional(),
    serviceId: z.string().optional(),
    caregiverId: z.string().optional(),
    startDate: z.string().min(1, 'Informe quando o contrato começa'),
    endDate: z.string().optional(),
    billingCycle: z.enum(['MONTHLY', 'BIWEEKLY']),
    amount: z
      .string()
      .min(1, 'Informe o valor de cada cobrança')
      .refine((v) => !Number.isNaN(Number(paraDecimal(v))), 'Valor inválido'),
    estimatedCost: dinheiroOpcional,
    billingDay: z.coerce.number().int().min(1, 'De 1 a 31').max(31, 'De 1 a 31'),
    billInArrears: z.boolean(),
    notes: z.string().max(2000).optional(),
  })
  .refine((d) => !d.endDate || d.endDate >= d.startDate, {
    path: ['endDate'],
    message: 'O término não pode ser antes do início',
  })

type Formulario = z.infer<typeof esquema>

export default function ContratoFormPage() {
  const { id } = useParams<{ id: string }>()
  const edicao = Boolean(id)
  const navegar = useNavigate()

  const pode = useAuth((e) => e.pode)
  const somenteLeitura = useAuth((e) => e.somenteLeitura)

  const [erroGeral, setErroGeral] = useState<string | null>(null)

  const { data: contrato, isLoading } = useContrato(id)
  const criar = useCriarContrato()
  const atualizar = useAtualizarContrato(id ?? '')
  const remover = useRemoverContrato()

  const clientes = useClientes({ status: 'active', perPage: 100 })
  const servicos = useServicos({ status: 'active' })
  const cuidadores = useCaregivers({ status: 'active' })

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: {
      customerId: '',
      name: '',
      code: '',
      serviceId: '',
      caregiverId: '',
      startDate: '',
      endDate: '',
      billingCycle: 'MONTHLY',
      amount: '',
      estimatedCost: '',
      billingDay: 10,
      billInArrears: false,
      notes: '',
    },
  })

  useEffect(() => {
    if (!contrato) return
    reset({
      customerId: contrato.customerId,
      name: contrato.name,
      code: contrato.code ?? '',
      serviceId: contrato.serviceId ?? '',
      caregiverId: contrato.caregiverId ?? '',
      startDate: contrato.startDate,
      endDate: contrato.endDate ?? '',
      billingCycle: contrato.billingCycle,
      amount: contrato.amount,
      estimatedCost: contrato.estimatedCost ?? '',
      billingDay: contrato.billingDay,
      billInArrears: contrato.billInArrears,
      notes: contrato.notes ?? '',
    })
  }, [contrato, reset])

  if (!pode('contracts:read')) return <SemPermissao />
  if (edicao && isLoading) return <Carregando />

  const podeEscrever = pode('contracts:write') && !somenteLeitura()

  async function enviar(dados: Formulario) {
    setErroGeral(null)

    const corpo = {
      customerId: dados.customerId,
      name: dados.name,
      code: dados.code || undefined,
      serviceId: dados.serviceId || undefined,
      caregiverId: dados.caregiverId || undefined,
      startDate: dados.startDate,
      endDate: dados.endDate || undefined,
      billingCycle: dados.billingCycle,
      amount: paraDecimal(dados.amount) as string,
      estimatedCost: paraDecimal(dados.estimatedCost),
      billingDay: dados.billingDay,
      billInArrears: dados.billInArrears,
      notes: dados.notes || undefined,
    }

    try {
      const salvo = edicao ? await atualizar.mutateAsync(corpo) : await criar.mutateAsync(corpo)
      void navegar(`/contratos/${salvo.id}`, { replace: true })
    } catch (erro) {
      if (erro instanceof ApiError && erro.fields) {
        for (const [campo, mensagem] of Object.entries(erro.fields)) {
          setError(campo as keyof Formulario, { message: mensagem })
        }
        return
      }
      setErroGeral(
        erro instanceof ApiError ? erro.message : 'Não conseguimos salvar o contrato agora.',
      )
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <Link
          to="/contratos"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Contratos
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          {edicao ? contrato?.name : 'Novo contrato'}
        </h1>
        {edicao && contrato && (
          <p className="text-ink-muted">
            {contrato.customerName} ·{' '}
            <span className="tabular">{formatarDinheiro(contrato.monthlyAmount)}</span> por mês
          </p>
        )}
      </header>

      {edicao && contrato && (
        <SituacaoDoContrato contrato={contrato} podeEscrever={podeEscrever} />
      )}

      <Card>
        <CardHeader
          titulo="Dados do contrato"
          descricao="O valor aqui é de CADA cobrança. No ciclo quinzenal, o mês soma duas."
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

            <Selecao
              label="Cliente"
              obrigatorio
              disabled={!podeEscrever}
              placeholder={clientes.isLoading ? 'Carregando…' : 'Escolha o cliente'}
              erro={errors.customerId?.message}
              opcoes={(clientes.data?.data ?? []).map((c) => ({ valor: c.id, rotulo: c.name }))}
              {...register('customerId')}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <InputField
                label="Nome do contrato"
                obrigatorio
                disabled={!podeEscrever}
                placeholder="Acompanhamento 12h — Dona Marta"
                erro={errors.name?.message}
                {...register('name')}
              />
              <InputField
                label="Número interno"
                disabled={!podeEscrever}
                ajuda="Do contrato assinado, se houver."
                erro={errors.code?.message}
                {...register('code')}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <InputField
                label="Início"
                type="date"
                obrigatorio
                disabled={!podeEscrever}
                erro={errors.startDate?.message}
                {...register('startDate')}
              />
              <InputField
                label="Término"
                type="date"
                disabled={!podeEscrever}
                ajuda="Vazio = sem prazo."
                erro={errors.endDate?.message}
                {...register('endDate')}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <InputField
                label="Valor de cada cobrança"
                inputMode="decimal"
                obrigatorio
                disabled={!podeEscrever}
                placeholder="3200,00"
                erro={errors.amount?.message}
                {...register('amount')}
              />
              <InputField
                label="Custo previsto com cuidador"
                inputMode="decimal"
                disabled={!podeEscrever}
                ajuda="Por ciclo. Serve para o painel mostrar a margem esperada."
                erro={errors.estimatedCost?.message}
                {...register('estimatedCost')}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Selecao
                label="Ciclo de cobrança"
                obrigatorio
                disabled={!podeEscrever}
                placeholder="Escolha o ciclo"
                erro={errors.billingCycle?.message}
                opcoes={(['MONTHLY', 'BIWEEKLY'] as const).map((c) => ({
                  valor: c,
                  rotulo: ROTULO_CICLO[c],
                }))}
                {...register('billingCycle')}
              />
              <InputField
                label="Dia do vencimento"
                type="number"
                min={1}
                max={31}
                obrigatorio
                disabled={!podeEscrever}
                ajuda="31 cai no último dia do mês."
                erro={errors.billingDay?.message}
                {...register('billingDay')}
              />
            </div>

            <CheckboxField
              label="Cobrar no mês seguinte ao atendido"
              descricao="A competência continua sendo o mês prestado — só o vencimento anda para frente."
              disabled={!podeEscrever}
              {...register('billInArrears')}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Selecao
                label="Serviço"
                disabled={!podeEscrever}
                placeholder="Nenhum"
                ajuda="Só para o relatório por serviço."
                erro={errors.serviceId?.message}
                opcoes={(servicos.data?.data ?? []).map((s) => ({ valor: s.id, rotulo: s.name }))}
                {...register('serviceId')}
              />
              <Selecao
                label="Cuidador de referência"
                disabled={!podeEscrever}
                placeholder="Nenhum"
                erro={errors.caregiverId?.message}
                opcoes={(cuidadores.data?.data ?? []).map((c) => ({ valor: c.id, rotulo: c.name }))}
                {...register('caregiverId')}
              />
            </div>

            <TextareaField
              label="Observações"
              disabled={!podeEscrever}
              erro={errors.notes?.message}
              {...register('notes')}
            />

            {podeEscrever && (
              <div className="flex flex-wrap gap-2">
                <Button type="submit" carregando={isSubmitting}>
                  {edicao ? 'Salvar alterações' : 'Criar contrato'}
                </Button>

                {edicao && contrato && (
                  <Button
                    variante="ghost"
                    carregando={remover.isPending}
                    iconeEsquerda={<Trash2 className="size-5 text-danger" aria-hidden="true" />}
                    className="gap-2"
                    onClick={() => {
                      if (!window.confirm(`Excluir o contrato "${contrato.name}"?`)) return
                      remover.mutate(contrato.id, {
                        onSuccess: () => void navegar('/contratos', { replace: true }),
                        onError: (e) =>
                          setErroGeral(
                            e instanceof ApiError
                              ? e.message
                              : 'Não conseguimos excluir o contrato.',
                          ),
                      })
                    }}
                  >
                    Excluir
                  </Button>
                )}
              </div>
            )}
          </form>
        </CardBody>
      </Card>

      {edicao && <HistoricoDeCobrancas id={id} />}
    </div>
  )
}

// ─── Situação ─────────────────────────────────────────────────────────────────

function SituacaoDoContrato({
  contrato,
  podeEscrever,
}: {
  contrato: { id: string; status: StatusContrato; statusReason: string | null }
  podeEscrever: boolean
}) {
  const [erro, setErro] = useState<string | null>(null)
  const mudar = useMudarStatusContrato(contrato.id)

  function alterar(status: StatusContrato) {
    setErro(null)

    // Suspender e encerrar exigem motivo no backend — e com razão: seis meses
    // depois, "por que este contrato parou?" é a pergunta que ninguém responde.
    let reason: string | undefined
    if (status === 'SUSPENDED' || status === 'ENDED') {
      const rotulo = status === 'SUSPENDED' ? 'suspensão' : 'encerramento'
      const informado = window.prompt(`Motivo da ${rotulo}:`)
      if (!informado?.trim()) return
      reason = informado.trim()
    }

    if (
      status === 'ENDED' &&
      !window.confirm('Encerrar é definitivo: o contrato não volta a ficar ativo. Confirmar?')
    ) {
      return
    }

    mudar.mutate(
      { status, reason },
      {
        onError: (e) =>
          setErro(e instanceof ApiError ? e.message : 'Não conseguimos mudar a situação.'),
      },
    )
  }

  const acoes: StatusContrato[] =
    contrato.status === 'ENDED'
      ? []
      : contrato.status === 'ACTIVE'
        ? ['SUSPENDED', 'ENDED']
        : ['ACTIVE', 'ENDED']

  return (
    <Card>
      <CardBody className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge
              tom={
                contrato.status === 'ACTIVE'
                  ? 'sucesso'
                  : contrato.status === 'SUSPENDED'
                    ? 'aviso'
                    : 'neutro'
              }
            >
              {ROTULO_STATUS[contrato.status]}
            </Badge>
            <span className="text-sm text-ink-muted">{RESUMO_STATUS[contrato.status]}</span>
          </div>
          {contrato.statusReason && (
            <p className="mt-1 text-sm text-ink-subtle">Motivo: {contrato.statusReason}</p>
          )}
          {erro && (
            <p role="alert" className="mt-1 text-sm text-danger">
              {erro}
            </p>
          )}
        </div>

        {podeEscrever && acoes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {acoes.map((status) => (
              <Button
                key={status}
                variante={status === 'ACTIVE' ? 'primary' : 'secondary'}
                tamanho="sm"
                carregando={mudar.isPending}
                onClick={() => alterar(status)}
              >
                {status === 'ACTIVE' ? 'Ativar' : status === 'SUSPENDED' ? 'Suspender' : 'Encerrar'}
              </Button>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  )
}

// ─── Cobranças já emitidas ────────────────────────────────────────────────────

function HistoricoDeCobrancas({ id }: { id: string | undefined }) {
  const { data, isLoading } = useCobrancasDoContrato(id)

  if (isLoading) return null

  const cobrancas = data ?? []

  return (
    <Card>
      <CardHeader
        titulo="Cobranças emitidas"
        descricao="O que já saiu deste contrato para o contas a receber."
      />
      <CardBody className="pt-3">
        {cobrancas.length === 0 ? (
          <p className="text-ink-muted">
            Nenhuma cobrança ainda. Elas aparecem aqui depois da rodada do mês.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {cobrancas.map((cobranca) => (
              <li
                key={cobranca.id}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 first:pt-0 last:pb-0"
              >
                <span className="min-w-0">
                  <span className="block truncate text-ink">
                    {formatarCompetencia(cobranca.competence)}
                  </span>
                  <span className="tabular block text-sm text-ink-subtle">
                    vence {formatarData(cobranca.dueDate)}
                    {cobranca.paidAt && ` · pago ${formatarData(cobranca.paidAt)}`}
                  </span>
                </span>

                <span className="flex items-center gap-2">
                  <span className="tabular font-semibold text-ink">
                    {formatarDinheiro(cobranca.amount)}
                  </span>
                  <Badge
                    tom={
                      cobranca.status === 'PAID'
                        ? 'sucesso'
                        : cobranca.status === 'OVERDUE'
                          ? 'perigo'
                          : cobranca.status === 'CANCELED'
                            ? 'neutro'
                            : 'info'
                    }
                  >
                    {cobranca.status === 'PAID'
                      ? 'Recebido'
                      : cobranca.status === 'OVERDUE'
                        ? 'Atrasado'
                        : cobranca.status === 'CANCELED'
                          ? 'Cancelado'
                          : 'Em aberto'}
                  </Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}
