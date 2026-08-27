import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ChevronLeft, ChevronRight, Copy, Moon } from 'lucide-react'
import { useAuth } from '@/features/auth/auth.store'
import { hojeChave, semanaDe, somarDias } from '@/features/shifts/calendario'
import { STATUS_PLANTAO } from '@/features/shifts/plantoes.api'
import { ApiError } from '@/shared/api/client'
import { cn } from '@/shared/lib/cn'
import { formatarData, formatarDinheiro } from '@/shared/lib/format'
import { Button } from '@/shared/ui/Button'
import { Card, CardBody, CardHeader } from '@/shared/ui/Card'
import { CheckboxField } from '@/shared/ui/Field'
import { EstadoErro, ListaSkeleton, SemPermissao } from '@/shared/ui/feedback'
import {
  useCopiarSemana,
  useGradeDaEscala,
  type GradeDaEscala,
  type LinhaDaGrade,
  type PlantaoNaGrade,
  type ResultadoDaCopia,
} from './escalas.api'

/**
 * Grade da semana: uma linha por cuidador, uma coluna por dia.
 *
 * A pergunta que esta tela responde não é "quais plantões existem" — isso a
 * agenda já faz. É "quem está coberto e quem não está", olhando a semana
 * inteira de uma vez. Por isso a linha dos plantões sem cuidador vem primeiro e
 * destacada: é o buraco que alguém precisa tapar antes de sexta.
 */
export default function EscalasPage() {
  const pode = useAuth((e) => e.pode)
  const somenteLeitura = useAuth((e) => e.somenteLeitura)

  const [inicioDaSemana, setInicioDaSemana] = useState(() => semanaDe(hojeChave())[0])
  const [incluirInativos, setIncluirInativos] = useState(false)
  const [copiaAberta, setCopiaAberta] = useState(false)

  const fimDaSemana = somarDias(inicioDaSemana, 6)

  const { data, isLoading, isError, error, refetch } = useGradeDaEscala({
    from: inicioDaSemana,
    to: fimDaSemana,
    includeInactive: incluirInativos || undefined,
  })

  if (!pode('schedules:read')) return <SemPermissao />

  const podeEscrever = pode('schedules:write') && !somenteLeitura()
  const veDinheiro = pode('finance:read')
  const semanaAtual = semanaDe(hojeChave())[0] === inicioDaSemana

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Escalas</h1>
          <p className="mt-0.5 text-ink-muted">
            A semana inteira de uma vez: quem está escalado e o que ficou descoberto.
          </p>
        </div>

        {podeEscrever && (
          <Button
            variante="secondary"
            onClick={() => setCopiaAberta((v) => !v)}
            iconeEsquerda={<Copy className="size-5" aria-hidden="true" />}
            className="gap-2"
          >
            Repetir semana
          </Button>
        )}
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button
            variante="secondary"
            tamanho="sm"
            aria-label="Semana anterior"
            onClick={() => setInicioDaSemana((s) => somarDias(s, -7))}
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </Button>

          <span className="tabular px-2 text-center font-semibold text-ink">
            {formatarData(inicioDaSemana)} – {formatarData(fimDaSemana)}
          </span>

          <Button
            variante="secondary"
            tamanho="sm"
            aria-label="Próxima semana"
            onClick={() => setInicioDaSemana((s) => somarDias(s, 7))}
          >
            <ChevronRight className="size-5" aria-hidden="true" />
          </Button>

          {!semanaAtual && (
            <Button
              variante="ghost"
              tamanho="sm"
              onClick={() => setInicioDaSemana(semanaDe(hojeChave())[0])}
            >
              Esta semana
            </Button>
          )}
        </div>

        <CheckboxField
          label="Mostrar cuidadores inativos"
          checked={incluirInativos}
          onChange={(e) => setIncluirInativos(e.target.checked)}
        />
      </div>

      {copiaAberta && podeEscrever && (
        <RepetirSemana
          origem={inicioDaSemana}
          aoFechar={() => setCopiaAberta(false)}
          aoCopiar={(destino) => setInicioDaSemana(destino)}
        />
      )}

      {isLoading && !data ? (
        <ListaSkeleton linhas={4} />
      ) : isError ? (
        <EstadoErro erro={error} aoTentarNovamente={() => void refetch()} />
      ) : data ? (
        <>
          <ResumoDaSemana grade={data} veDinheiro={veDinheiro} />
          <Grade grade={data} />
        </>
      ) : null}
    </div>
  )
}

// ─── Resumo ───────────────────────────────────────────────────────────────────

function ResumoDaSemana({
  grade,
  veDinheiro,
}: {
  grade: GradeDaEscala
  veDinheiro: boolean
}) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1 rounded-card border border-border bg-surface px-4 py-3 text-sm">
      <span className="text-ink-muted">
        <span className="tabular font-semibold text-ink">{grade.totalShifts}</span>{' '}
        {grade.totalShifts === 1 ? 'plantão' : 'plantões'}
      </span>
      <span className="text-ink-muted">
        <span className="tabular font-semibold text-ink">{grade.totalHours}</span> horas
      </span>

      {grade.uncoveredShifts > 0 ? (
        <span className="flex items-center gap-1.5 font-medium text-danger">
          <AlertTriangle className="size-4" aria-hidden="true" />
          {grade.uncoveredShifts} sem cuidador
        </span>
      ) : (
        <span className="font-medium text-success">semana toda coberta</span>
      )}

      {veDinheiro && (
        <>
          <span className="tabular text-ink-muted">
            cobrado <span className="font-semibold text-ink">{formatarDinheiro(grade.chargeTotal)}</span>
          </span>
          <span className="tabular text-ink-muted">
            custo <span className="font-semibold text-ink">{formatarDinheiro(grade.costTotal)}</span>
          </span>
        </>
      )}
    </div>
  )
}

// ─── Grade ────────────────────────────────────────────────────────────────────

function Grade({ grade }: { grade: GradeDaEscala }) {
  const linhas = [
    ...(grade.uncovered.totalShifts > 0 ? [grade.uncovered] : []),
    ...grade.rows,
  ]

  if (linhas.length === 0) {
    return (
      <Card>
        <CardBody className="py-10 text-center">
          <p className="font-semibold text-ink">Nenhum plantão nesta semana</p>
          <p className="mt-1 text-ink-muted">
            Monte a escala pela agenda ou repita a semana anterior.
          </p>
        </CardBody>
      </Card>
    )
  }

  return (
    // A grade não cabe num celular, e espremer sete dias em 360px torna tudo
    // ilegível. Rola na horizontal com a coluna do cuidador fixa.
    <div className="overflow-x-auto rounded-card border border-border bg-surface">
      <table className="w-full min-w-[52rem] border-collapse">
        <caption className="sr-only">
          Escala de {formatarData(grade.from)} a {formatarData(grade.to)}
        </caption>
        <thead>
          <tr className="border-b border-border">
            <th
              scope="col"
              className="sticky left-0 z-10 bg-surface px-3 py-2.5 text-left text-sm font-semibold text-ink"
            >
              Cuidador
            </th>
            {grade.days.map((dia) => (
              <th
                key={dia.date}
                scope="col"
                className={cn(
                  'px-2 py-2.5 text-center text-sm font-semibold',
                  dia.isWeekend ? 'bg-surface-muted text-ink-muted' : 'text-ink',
                )}
              >
                <span className="block capitalize">{dia.weekdayLabel}</span>
                <span className="tabular block text-xs font-normal text-ink-subtle">
                  {dia.dayLabel}
                </span>
              </th>
            ))}
            <th scope="col" className="px-3 py-2.5 text-right text-sm font-semibold text-ink">
              Total
            </th>
          </tr>
        </thead>

        <tbody>
          {linhas.map((linha) => (
            <LinhaDaEscala
              key={linha.caregiverId ?? 'sem-cuidador'}
              linha={linha}
              descoberta={linha.caregiverId === null}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function LinhaDaEscala({ linha, descoberta }: { linha: LinhaDaGrade; descoberta: boolean }) {
  return (
    <tr className={cn('border-b border-border last:border-b-0', descoberta && 'bg-danger-soft/40')}>
      <th
        scope="row"
        className={cn(
          'sticky left-0 z-10 max-w-44 px-3 py-2 text-left align-top',
          descoberta ? 'bg-danger-soft' : 'bg-surface',
        )}
      >
        <span
          className={cn(
            'block truncate font-medium',
            descoberta ? 'text-danger' : 'text-ink',
          )}
        >
          {descoberta ? 'Sem cuidador' : linha.caregiverName}
        </span>
        {!linha.isActive && !descoberta && (
          <span className="text-xs text-ink-subtle">inativo</span>
        )}
      </th>

      {linha.cells.map((celula) => (
        <td key={celula.date} className="px-1.5 py-2 align-top">
          <div className="flex flex-col gap-1">
            {celula.shifts.map((plantao) => (
              <ChipDePlantao key={plantao.id} plantao={plantao} />
            ))}
          </div>
        </td>
      ))}

      <td className="px-3 py-2 text-right align-top">
        <span className="tabular block text-sm font-semibold text-ink">{linha.totalHours}h</span>
        <span className="tabular block text-xs text-ink-subtle">
          {linha.totalShifts} {linha.totalShifts === 1 ? 'plantão' : 'plantões'}
        </span>
      </td>
    </tr>
  )
}

function ChipDePlantao({ plantao }: { plantao: PlantaoNaGrade }) {
  const status = STATUS_PLANTAO[plantao.status]

  return (
    <Link
      to={`/plantoes/${plantao.id}`}
      className="block rounded-lg border border-border bg-surface px-2 py-1.5 transition-colors hover:bg-surface-muted"
      title={`${plantao.customerName} · ${status.rotulo}`}
    >
      <span className="flex items-center gap-1.5">
        {/* A cor é atalho para quem já conhece; o rótulo do status vai no
            title e no texto para leitor de tela — cor sozinha não comunica. */}
        <span className={cn('size-2 shrink-0 rounded-full', status.cor)} aria-hidden="true" />
        <span className="tabular truncate text-xs font-semibold text-ink">
          {plantao.startTime}–{plantao.endTime}
        </span>
        {plantao.overnight && (
          <Moon className="size-3 shrink-0 text-ink-subtle" aria-label="vira a noite" />
        )}
      </span>
      <span className="block truncate text-xs text-ink-muted">{plantao.customerName}</span>
      <span className="sr-only">{status.rotulo}</span>
    </Link>
  )
}

// ─── Repetir semana ───────────────────────────────────────────────────────────

/**
 * Copiar a escala é o que economiza a tarde de segunda de quem coordena: a
 * escala de uma empresa muda pouco de uma semana para a outra.
 *
 * Conflito de horário não interrompe a cópia — o backend devolve o que não deu
 * em `warnings`, e é isso que a tela mostra. Abortar tudo por causa de um
 * cuidador com dois plantões sobrepostos jogaria fora as outras 39 linhas.
 */
function RepetirSemana({
  origem,
  aoFechar,
  aoCopiar,
}: {
  origem: string
  aoFechar: () => void
  aoCopiar: (destino: string) => void
}) {
  const [destino, setDestino] = useState(() => somarDias(origem, 7))
  const [repeticoes, setRepeticoes] = useState(1)
  const [manterCuidadores, setManterCuidadores] = useState(true)
  const [resultado, setResultado] = useState<ResultadoDaCopia | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const copiar = useCopiarSemana()

  function executar() {
    setErro(null)
    setResultado(null)

    copiar.mutate(
      {
        sourceWeekStart: origem,
        targetWeekStart: destino,
        repeat: repeticoes,
        keepCaregivers: manterCuidadores,
      },
      {
        onSuccess: (r) => {
          setResultado(r)
          if (r.created > 0) aoCopiar(destino)
        },
        onError: (e) =>
          setErro(e instanceof ApiError ? e.message : 'Não conseguimos copiar a semana agora.'),
      },
    )
  }

  return (
    <Card>
      <CardHeader
        titulo="Repetir esta semana"
        descricao={`Copia os plantões planejados e confirmados de ${formatarData(origem)} para frente.`}
        acao={
          <Button variante="ghost" tamanho="sm" onClick={aoFechar}>
            Fechar
          </Button>
        }
      />
      <CardBody className="flex flex-col gap-3 pt-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="destino" className="text-sm font-medium text-ink">
              A partir de
            </label>
            <input
              id="destino"
              type="date"
              value={destino}
              min={somarDias(origem, 1)}
              onChange={(e) => setDestino(e.target.value)}
              className="tabular min-h-12 rounded-xl border border-border-strong bg-surface px-3.5 text-base text-ink"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="repeticoes" className="text-sm font-medium text-ink">
              Quantas semanas
            </label>
            <input
              id="repeticoes"
              type="number"
              min={1}
              max={12}
              value={repeticoes}
              onChange={(e) => setRepeticoes(Number(e.target.value))}
              className="tabular min-h-12 w-24 rounded-xl border border-border-strong bg-surface px-3.5 text-base text-ink"
            />
          </div>

          <Button carregando={copiar.isPending} onClick={executar} className="gap-2">
            Copiar
          </Button>
        </div>

        <CheckboxField
          label="Manter o mesmo cuidador em cada plantão"
          descricao="Desmarque para gerar a escala descoberta e distribuir depois."
          checked={manterCuidadores}
          onChange={(e) => setManterCuidadores(e.target.checked)}
        />

        {erro && (
          <p
            role="alert"
            className="rounded-xl border border-danger/30 bg-danger-soft px-3.5 py-3 text-sm text-danger"
          >
            {erro}
          </p>
        )}

        {resultado && (
          <div className="flex flex-col gap-2">
            <p
              role="status"
              className={cn(
                'rounded-xl border px-3.5 py-3 text-sm',
                resultado.created > 0
                  ? 'border-success/30 bg-success-soft text-success'
                  : 'border-border bg-surface-muted text-ink-muted',
              )}
            >
              {resultado.created > 0
                ? `${resultado.created} ${resultado.created === 1 ? 'plantão criado' : 'plantões criados'}.`
                : 'Nada foi criado.'}
              {resultado.skipped > 0 && ` ${resultado.skipped} já existiam.`}
              {resultado.conflicts > 0 &&
                ` ${resultado.conflicts} não couberam por conflito de horário.`}
            </p>

            {resultado.warnings.length > 0 && (
              <details className="rounded-xl border border-border px-3.5 py-2.5">
                <summary className="cursor-pointer text-sm font-medium text-ink-muted">
                  Ver o que ficou de fora
                </summary>
                <ul className="mt-2 flex flex-col gap-1">
                  {resultado.warnings.map((aviso, i) => (
                    <li key={i} className="text-sm text-ink-muted">
                      {aviso}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  )
}
