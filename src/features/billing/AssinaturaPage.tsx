import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CircleAlert, CreditCard, ExternalLink, Gift, Info, RefreshCw, Tag } from 'lucide-react'
import { useAuth } from '@/features/auth/auth.store'
import { formatarCentavos, formatarData, formatarDinheiro } from '@/shared/lib/format'
import { Button } from '@/shared/ui/Button'
import { Badge, Card, CardBody, CardHeader } from '@/shared/ui/Card'
import { TextareaField } from '@/shared/ui/Field'
import { estilosBotao } from '@/shared/ui/button.styles'
import { EstadoErro, ListaSkeleton, SemPermissao } from '@/shared/ui/feedback'
import {
  ROTULO_ASSINATURA,
  ROTULO_COBRANCA,
  useAssinatura,
  useCancelarAssinatura,
  usePagamentos,
  useSincronizarAssinatura,
  comDesconto,
  type Assinatura,
  type Cobranca,
  type StatusAssinatura,
  type StatusCobranca,
} from './assinatura.api'

const TOM_ASSINATURA: Record<StatusAssinatura, 'sucesso' | 'aviso' | 'perigo' | 'neutro'> = {
  ACTIVE: 'sucesso',
  TRIAL: 'neutro',
  PAST_DUE: 'aviso',
  SUSPENDED: 'perigo',
  CANCELED: 'neutro',
}

const TOM_COBRANCA: Record<StatusCobranca, 'sucesso' | 'aviso' | 'perigo' | 'neutro'> = {
  APPROVED: 'sucesso',
  PENDING: 'aviso',
  REJECTED: 'perigo',
  CHARGED_BACK: 'perigo',
  REFUNDED: 'neutro',
  CANCELLED: 'neutro',
}

/**
 * A tela da assinatura da conta.
 *
 * Responde três perguntas, nesta ordem de importância: em que estado eu estou,
 * quando vou ser cobrado de novo, e o que aconteceu com as cobranças passadas.
 * O extrato não é enfeite — é o que responde "por que minha conta foi suspensa"
 * sem ninguém precisar abrir o painel do Mercado Pago.
 */
export default function AssinaturaPage() {
  const pode = useAuth((e) => e.pode)
  const { data, isLoading, isError, error, refetch } = useAssinatura()
  const sincronizar = useSincronizarAssinatura()

  if (!pode('billing:read')) return <SemPermissao />

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Assinatura</h1>
          <p className="mt-0.5 text-ink-muted">
            Seu plano, a próxima cobrança e o histórico do que já foi pago.
          </p>
        </div>

        <Link to="/planos" className={estilosBotao({ variante: 'secondary', className: 'gap-2' })}>
          <CreditCard className="size-5" aria-hidden="true" />
          Ver planos
        </Link>
      </header>

      {isLoading ? (
        <ListaSkeleton linhas={3} />
      ) : isError || !data ? (
        <EstadoErro erro={error} aoTentarNovamente={() => void refetch()} />
      ) : (
        <>
          <ResumoDaAssinatura
            assinatura={data}
            sincronizando={sincronizar.isPending}
            aoSincronizar={() => sincronizar.mutate()}
          />

          {pode('billing:write') && data.status !== 'CANCELED' && (
            <Cancelamento assinatura={data} />
          )}

          <Extrato />
        </>
      )}
    </div>
  )
}

function ResumoDaAssinatura({
  assinatura,
  sincronizando,
  aoSincronizar,
}: {
  assinatura: Assinatura
  sincronizando: boolean
  aoSincronizar: () => void
}) {
  const emTeste = assinatura.status === 'TRIAL'
  const desconto = assinatura.discount

  return (
    <Card>
      <CardHeader
        titulo={assinatura.plan?.name ?? 'Sem plano definido'}
        descricao={assinatura.plan?.description ?? undefined}
        acao={<Badge tom={TOM_ASSINATURA[assinatura.status]}>{ROTULO_ASSINATURA[assinatura.status]}</Badge>}
      />

      <CardBody className="flex flex-col gap-4">
        <dl className="grid gap-4 sm:grid-cols-3">
          <Dado
            rotulo="Valor"
            valor={valorMensal(assinatura)}
            detalhe={
              desconto && !desconto.courtesy && assinatura.plan
                ? `Sem o cupom: ${formatarDinheiro(assinatura.plan.price)}`
                : undefined
            }
          />
          <Dado
            rotulo={emTeste ? 'Teste termina em' : 'Próxima cobrança'}
            valor={
              emTeste
                ? assinatura.trialEndsAt
                  ? formatarData(assinatura.trialEndsAt)
                  : '—'
                : assinatura.nextChargeAt
                  ? formatarData(assinatura.nextChargeAt)
                  : '—'
            }
          />
          <Dado
            rotulo="Acesso garantido até"
            valor={
              assinatura.currentPeriodEnd ? formatarData(assinatura.currentPeriodEnd) : '—'
            }
          />
        </dl>

        {desconto && (
          <Faixa tom={desconto.courtesy ? 'info' : 'info'} icone={desconto.courtesy ? Gift : Tag}>
            <strong>Cupom {desconto.code}</strong> — {desconto.summary}.{' '}
            {desconto.courtesy
              ? 'Enquanto durar, não há cobrança nem cartão cadastrado.'
              : 'Depois das faturas com desconto, a cobrança volta ao valor cheio do plano.'}
          </Faixa>
        )}

        {assinatura.pendingPlan && (
          <Faixa tom="info" icone={Info}>
            Mudança para <strong>{assinatura.pendingPlan.name}</strong> agendada. Ela entra na
            virada do período — até lá vale o plano atual, que já está pago.
          </Faixa>
        )}

        {assinatura.canceledAt && assinatura.currentPeriodEnd && (
          <Faixa tom="aviso" icone={Info}>
            Assinatura cancelada em {formatarData(assinatura.canceledAt)}. A conta continua
            funcionando até {formatarData(assinatura.currentPeriodEnd)}.
          </Faixa>
        )}

        {assinatura.status === 'PAST_DUE' && (
          <Faixa tom="perigo" icone={CircleAlert}>
            A última cobrança não passou. O Mercado Pago tenta de novo automaticamente; atualizar o
            cartão resolve na hora e evita a suspensão.
          </Faixa>
        )}

        {assinatura.checkoutUrl && (
          <Faixa tom="info" icone={Info}>
            Existe um checkout em aberto.{' '}
            <a
              href={assinatura.checkoutUrl}
              className="inline-flex items-center gap-1 font-semibold underline underline-offset-2"
            >
              Continuar de onde parou
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          </Faixa>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variante="ghost"
            tamanho="sm"
            carregando={sincronizando}
            onClick={aoSincronizar}
            iconeEsquerda={<RefreshCw className="size-4" aria-hidden="true" />}
          >
            Atualizar situação
          </Button>
          <p className="text-xs text-ink-subtle">
            Pagou e a conta ainda não liberou? A confirmação do banco pode levar alguns minutos.
          </p>
        </div>
      </CardBody>
    </Card>
  )
}

function Cancelamento({ assinatura }: { assinatura: Assinatura }) {
  const [aberto, setAberto] = useState(false)
  const [motivo, setMotivo] = useState('')
  const cancelar = useCancelarAssinatura()

  if (!aberto) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
        <div>
          <h2 className="font-semibold text-ink">Cancelar assinatura</h2>
          <p className="text-sm text-ink-muted">
            A conta continua funcionando até o fim do período já pago, e nada é apagado depois.
          </p>
        </div>
        <Button variante="ghost" onClick={() => setAberto(true)}>
          Cancelar assinatura
        </Button>
      </Card>
    )
  }

  return (
    <Card className="flex flex-col gap-3 p-4 sm:p-5">
      <h2 className="font-semibold text-ink">Tem certeza?</h2>
      <p className="text-sm text-ink-muted">
        Não haverá nova cobrança.{' '}
        {assinatura.currentPeriodEnd
          ? `Você continua usando normalmente até ${formatarData(assinatura.currentPeriodEnd)}.`
          : 'A conta passa a somente leitura, com os dados preservados.'}{' '}
        Depois disso, os dados continuam disponíveis para consulta e exportação.
      </p>

      <TextareaField
        label="Por que está cancelando? (opcional)"
        ajuda="Isso não vai para lugar nenhum além da nossa lista do que precisa melhorar."
        rows={3}
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
      />

      {cancelar.isError && (
        <p className="text-sm text-danger">
          {cancelar.error instanceof Error
            ? cancelar.error.message
            : 'Não foi possível cancelar agora.'}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          variante="danger"
          carregando={cancelar.isPending}
          onClick={() =>
            cancelar.mutate(motivo.trim() || undefined, { onSuccess: () => setAberto(false) })
          }
        >
          Confirmar cancelamento
        </Button>
        <Button variante="ghost" onClick={() => setAberto(false)} disabled={cancelar.isPending}>
          Voltar
        </Button>
      </div>
    </Card>
  )
}

function Extrato() {
  const { data, isLoading, isError, error, refetch } = usePagamentos()

  if (isLoading) return <ListaSkeleton linhas={3} />
  if (isError) return <EstadoErro erro={error} aoTentarNovamente={() => void refetch()} />

  const cobrancas = data ?? []

  return (
    <Card>
      <CardHeader
        titulo="Cobranças"
        descricao="Cada tentativa de cobrança da mensalidade, aprovada ou não."
      />
      <CardBody>
        {cobrancas.length === 0 ? (
          <p className="text-sm text-ink-muted">
            Nenhuma cobrança ainda. Elas aparecem aqui a partir da primeira mensalidade.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-ink-muted">
                  <th scope="col" className="pb-2 font-medium">
                    Data
                  </th>
                  <th scope="col" className="pb-2 font-medium">
                    Valor
                  </th>
                  <th scope="col" className="pb-2 font-medium">
                    Situação
                  </th>
                  <th scope="col" className="pb-2 font-medium">
                    Observação
                  </th>
                </tr>
              </thead>
              <tbody>
                {cobrancas.map((cobranca) => (
                  <LinhaDeCobranca key={cobranca.id} cobranca={cobranca} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  )
}

function LinhaDeCobranca({ cobranca }: { cobranca: Cobranca }) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-2.5 text-ink">
        {formatarData(cobranca.paidAt ?? cobranca.dueAt ?? cobranca.createdAt)}
      </td>
      <td className="tabular py-2.5 text-ink">{formatarDinheiro(cobranca.amount)}</td>
      <td className="py-2.5">
        <Badge tom={TOM_COBRANCA[cobranca.status]}>{ROTULO_COBRANCA[cobranca.status]}</Badge>
      </td>
      <td className="py-2.5 text-ink-muted">{explicar(cobranca) ?? '—'}</td>
    </tr>
  )
}

/**
 * O código de recusa do provedor não serve para o cliente ler. Traduzir o que
 * dá é o que transforma "cc_rejected_insufficient_amount" em algo acionável; o
 * que não estiver na lista passa direto, porque um código estranho ainda é
 * melhor que uma explicação inventada.
 */
function explicar(cobranca: Cobranca): string | null {
  if (!cobranca.statusDetail) return cobranca.paymentMethod
  const mapa: Record<string, string> = {
    cc_rejected_insufficient_amount: 'Saldo ou limite insuficiente',
    cc_rejected_bad_filled_card_number: 'Número do cartão incorreto',
    cc_rejected_bad_filled_date: 'Validade incorreta',
    cc_rejected_bad_filled_security_code: 'Código de segurança incorreto',
    cc_rejected_call_for_authorize: 'O banco pediu autorização do titular',
    cc_rejected_card_disabled: 'Cartão desabilitado para compras online',
    cc_rejected_high_risk: 'Recusada por análise de risco',
    cc_rejected_max_attempts: 'Muitas tentativas seguidas',
    cc_rejected_other_reason: 'Recusada pelo banco emissor',
  }
  return mapa[cobranca.statusDetail] ?? cobranca.statusDetail
}

function Dado({
  rotulo,
  valor,
  detalhe,
}: {
  rotulo: string
  valor: string
  detalhe?: string
}) {
  return (
    <div>
      <dt className="text-sm text-ink-muted">{rotulo}</dt>
      <dd className="mt-0.5 font-semibold text-ink">{valor}</dd>
      {detalhe && <p className="text-xs text-ink-subtle line-through">{detalhe}</p>}
    </div>
  )
}

/**
 * O valor que a conta paga HOJE — com o cupom, quando ele existe.
 *
 * Mostrar o preço de tabela para quem tem desconto seria a forma mais rápida de
 * gerar a dúvida "vocês vão me cobrar isso?" logo depois de aplicar um cupom.
 */
function valorMensal(assinatura: Assinatura): string {
  if (!assinatura.plan) return '—'

  const desconto = assinatura.discount
  if (!desconto) return `${formatarDinheiro(assinatura.plan.price)} / mês`
  if (desconto.courtesy) return 'Sem cobrança'

  return `${formatarCentavos(comDesconto(assinatura.plan.priceCents, desconto.discountPercent))} / mês`
}

function Faixa({
  tom,
  icone: Icone,
  children,
}: {
  tom: 'info' | 'aviso' | 'perigo'
  icone: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  children: React.ReactNode
}) {
  const cores = {
    info: 'border-info/30 bg-info-soft text-info',
    aviso: 'border-warning/30 bg-warning-soft text-warning',
    perigo: 'border-danger/30 bg-danger-soft text-danger',
  }[tom]

  return (
    <div className={`flex items-start gap-2 rounded-card border p-3.5 text-sm ${cores}`}>
      <Icone className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>{children}</p>
    </div>
  )
}
