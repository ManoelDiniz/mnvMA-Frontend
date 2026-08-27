import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ChevronRight, Play, Plus, Receipt } from 'lucide-react'
import { useAuth } from '@/features/auth/auth.store'
import { ApiError } from '@/shared/api/client'
import { formatarData, formatarDinheiro } from '@/shared/lib/format'
import { Button } from '@/shared/ui/Button'
import { Badge, Card, CardBody, CardHeader } from '@/shared/ui/Card'
import { estilosBotao } from '@/shared/ui/button.styles'
import { EstadoErro, EstadoVazio, ListaSkeleton, SemPermissao } from '@/shared/ui/feedback'
import {
  ROTULO_STATUS,
  competenciaAtual,
  formatarCompetencia,
  useContratos,
  useRodadaDeCobranca,
  type Contrato,
  type ResultadoDaRodada,
  type StatusContrato,
} from './contratos.api'

const TOM_STATUS: Record<StatusContrato, 'sucesso' | 'aviso' | 'neutro'> = {
  ACTIVE: 'sucesso',
  SUSPENDED: 'aviso',
  DRAFT: 'neutro',
  ENDED: 'neutro',
}

export default function ContratosPage() {
  const pode = useAuth((e) => e.pode)
  const somenteLeitura = useAuth((e) => e.somenteLeitura)

  const { data, isLoading, isError, error, refetch } = useContratos()

  if (!pode('contracts:read')) return <SemPermissao />

  const contratos = data?.data ?? []
  const podeEscrever = pode('contracts:write') && !somenteLeitura()
  const podeCobrar = pode('finance:write') && !somenteLeitura()

  const ativos = contratos.filter((c) => c.inForce)

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Contratos</h1>
          <p className="mt-0.5 text-ink-muted">
            A receita que entra todo mês, independentemente de quantos plantões couberam no
            calendário.
          </p>
        </div>

        {podeEscrever && (
          <Link to="/contratos/novo" className={estilosBotao({ className: 'gap-2' })}>
            <Plus className="size-5" aria-hidden="true" />
            Novo contrato
          </Link>
        )}
      </header>

      {podeCobrar && ativos.length > 0 && <RodadaDeCobranca ativos={ativos.length} />}

      {isLoading ? (
        <ListaSkeleton linhas={3} />
      ) : isError ? (
        <EstadoErro erro={error} aoTentarNovamente={() => void refetch()} />
      ) : contratos.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum contrato cadastrado"
          descricao="Contrato é o atendimento combinado por mês, com valor fixo. Ele cobra sozinho, sem depender de plantão lançado."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {contratos.map((contrato) => (
            <li key={contrato.id}>
              <LinhaContrato contrato={contrato} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function LinhaContrato({ contrato }: { contrato: Contrato }) {
  return (
    <Link
      to={`/contratos/${contrato.id}`}
      className="flex min-h-16 items-center gap-3 rounded-card border border-border bg-surface p-3.5 transition-colors hover:bg-surface-muted"
    >
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-ink">{contrato.name}</span>
          <Badge tom={TOM_STATUS[contrato.status]}>{ROTULO_STATUS[contrato.status]}</Badge>
          {contrato.code && (
            <span className="tabular text-xs text-ink-subtle">{contrato.code}</span>
          )}
        </span>

        <span className="mt-0.5 block truncate text-sm text-ink-muted">
          {contrato.customerName}
        </span>

        <span className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm">
          <span className="tabular font-semibold text-ink">
            {formatarDinheiro(contrato.monthlyAmount)}
            <span className="font-normal text-ink-muted"> /mês</span>
          </span>

          {contrato.billingsPerCompetence > 1 && (
            <span className="text-ink-muted">
              {contrato.billingsPerCompetence}× {formatarDinheiro(contrato.amount)}
            </span>
          )}

          <span className="text-ink-muted">vence dia {contrato.billingDay}</span>

          {contrato.monthlyMargin && (
            <span className="tabular text-ink-muted">
              sobra{' '}
              <span className="font-medium text-success">
                {formatarDinheiro(contrato.monthlyMargin)}
              </span>
            </span>
          )}
        </span>

        <span className="text-sm text-ink-subtle">
          {contrato.lastBilledCompetence
            ? `cobrado até ${formatarCompetencia(contrato.lastBilledCompetence)}`
            : 'ainda não cobrado'}
          {contrato.endDate && ` · até ${formatarData(contrato.endDate)}`}
        </span>
      </span>

      <ChevronRight className="size-5 shrink-0 text-ink-subtle" aria-hidden="true" />
    </Link>
  )
}

// ─── Rodada de cobrança ───────────────────────────────────────────────────────

/**
 * Duas etapas obrigatórias: prévia e confirmação.
 *
 * Gerar cobrança é a ação mais cara de desfazer do produto — cada engano vira um
 * telefonema com a família de um idoso. Por isso a tela nunca cobra no primeiro
 * clique, e o que ela mostra na prévia é exatamente o que vai gravar.
 */
function RodadaDeCobranca({ ativos }: { ativos: number }) {
  const [competencia, setCompetencia] = useState(competenciaAtual())
  const [previa, setPrevia] = useState<ResultadoDaRodada | null>(null)
  const [confirmado, setConfirmado] = useState<ResultadoDaRodada | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const rodada = useRodadaDeCobranca()

  function executar(dryRun: boolean) {
    setErro(null)
    rodada.mutate(
      { competence: competencia, dryRun },
      {
        onSuccess: (resultado) => {
          if (dryRun) {
            setPrevia(resultado)
            setConfirmado(null)
          } else {
            setConfirmado(resultado)
            setPrevia(null)
          }
        },
        onError: (e) =>
          setErro(e instanceof ApiError ? e.message : 'Não conseguimos rodar a cobrança agora.'),
      },
    )
  }

  const resultado = confirmado ?? previa

  return (
    <Card>
      <CardHeader
        titulo="Cobrança do mês"
        descricao={`${ativos} ${ativos === 1 ? 'contrato ativo' : 'contratos ativos'}. Confira a prévia antes de gravar — rodar de novo não cobra duas vezes.`}
      />
      <CardBody className="flex flex-col gap-3 pt-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="competencia" className="text-sm font-medium text-ink">
              Competência
            </label>
            <input
              id="competencia"
              type="month"
              value={competencia}
              onChange={(e) => {
                setCompetencia(e.target.value)
                setPrevia(null)
                setConfirmado(null)
              }}
              className="tabular min-h-12 rounded-xl border border-border-strong bg-surface px-3.5 text-base text-ink"
            />
          </div>

          <Button
            variante="secondary"
            carregando={rodada.isPending}
            onClick={() => executar(true)}
            iconeEsquerda={<Receipt className="size-5" aria-hidden="true" />}
            className="gap-2"
          >
            Ver prévia
          </Button>

          {previa && previa.created > 0 && (
            <Button
              carregando={rodada.isPending}
              onClick={() => {
                if (
                  !window.confirm(
                    `Gerar ${previa.created} ${previa.created === 1 ? 'cobrança' : 'cobranças'} de ${formatarDinheiro(previa.total)} para ${formatarCompetencia(previa.competence)}?`,
                  )
                ) {
                  return
                }
                executar(false)
              }}
              iconeEsquerda={<Play className="size-5" aria-hidden="true" />}
              className="gap-2"
            >
              Gerar {previa.created === 1 ? 'a cobrança' : `as ${previa.created} cobranças`}
            </Button>
          )}
        </div>

        {erro && (
          <p
            role="alert"
            className="rounded-xl border border-danger/30 bg-danger-soft px-3.5 py-3 text-sm text-danger"
          >
            {erro}
          </p>
        )}

        {confirmado && (
          <p
            role="status"
            className="rounded-xl border border-success/30 bg-success-soft px-3.5 py-3 text-sm text-success"
          >
            {confirmado.created === 0
              ? 'Nada novo a cobrar nesta competência.'
              : `${confirmado.created} ${confirmado.created === 1 ? 'cobrança gerada' : 'cobranças geradas'} · ${formatarDinheiro(confirmado.total)}. Já estão no contas a receber.`}
          </p>
        )}

        {resultado && <ResumoDaRodada resultado={resultado} />}
      </CardBody>
    </Card>
  )
}

function ResumoDaRodada({ resultado }: { resultado: ResultadoDaRodada }) {
  const gerados = resultado.items.filter((i) => i.result === 'created')
  const pulados = resultado.items.filter((i) => i.result === 'skipped')

  return (
    <div className="flex flex-col gap-3">
      {resultado.dryRun && (
        <p className="flex items-start gap-2 text-sm text-ink-muted">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          <span>
            Prévia de {formatarCompetencia(resultado.competence)} — nada foi gravado ainda.
          </span>
        </p>
      )}

      {gerados.length > 0 && (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {gerados.map((item) => (
            <li
              key={item.contractId}
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3.5 py-2.5"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium text-ink">{item.contractName}</span>
                <span className="block truncate text-sm text-ink-muted">{item.customerName}</span>
                <span className="tabular text-sm text-ink-subtle">
                  {item.dueDates.map((d) => formatarData(d)).join(' · ')}
                </span>
              </span>
              <span className="tabular font-semibold text-ink">
                {formatarDinheiro(item.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {pulados.length > 0 && (
        <details className="rounded-xl border border-border px-3.5 py-2.5">
          <summary className="cursor-pointer text-sm font-medium text-ink-muted">
            {pulados.length} {pulados.length === 1 ? 'contrato ficou' : 'contratos ficaram'} de fora
          </summary>
          <ul className="mt-2 flex flex-col gap-1">
            {pulados.map((item) => (
              <li key={item.contractId} className="text-sm text-ink-muted">
                <span className="text-ink">{item.contractName}</span> — {item.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
