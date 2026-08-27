import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useAuth } from '@/features/auth/auth.store'
import { cn } from '@/shared/lib/cn'
import { formatarDinheiro, formatarHora } from '@/shared/lib/format'
import { estilosBotao } from '@/shared/ui/button.styles'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { EstadoErro, EstadoVazio, ListaSkeleton, SemPermissao } from '@/shared/ui/feedback'
import {
  SIGLAS_SEMANA,
  agruparPorDia,
  fimDoDia,
  gradeDoMes,
  hojeChave,
  inicioDoDia,
  mesmoMes,
  rotuloDia,
  rotuloMes,
  semanaDe,
  somarDias,
  somarMeses,
} from './calendario'
import { STATUS_PLANTAO, usePlantoes, type Plantao } from './plantoes.api'

type Visao = 'mes' | 'semana' | 'dia'

export default function AgendaPage() {
  const [visao, setVisao] = useState<Visao>('mes')
  const [referencia, setReferencia] = useState(hojeChave)

  const pode = useAuth((e) => e.pode)
  const somenteLeitura = useAuth((e) => e.somenteLeitura)

  const dias = useMemo(() => {
    if (visao === 'mes') return gradeDoMes(referencia)
    if (visao === 'semana') return semanaDe(referencia)
    return [referencia]
  }, [visao, referencia])

  const periodo = useMemo(
    () => ({
      from: inicioDoDia(dias[0]).toISOString(),
      to: fimDoDia(dias[dias.length - 1]).toISOString(),
    }),
    [dias],
  )

  const { data, isLoading, isError, error, refetch } = usePlantoes(periodo)
  const porDia = useMemo(() => agruparPorDia(data ?? []), [data])

  if (!pode('shifts:read')) return <SemPermissao />

  const podeCriar = pode('shifts:write') && !somenteLeitura()
  const hoje = hojeChave()

  function navegar(direcao: -1 | 1) {
    if (visao === 'mes') setReferencia(somarMeses(referencia, direcao))
    else if (visao === 'semana') setReferencia(somarDias(referencia, direcao * 7))
    else setReferencia(somarDias(referencia, direcao))
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Agenda</h1>
          <p className="mt-0.5 text-ink-muted">
            {data ? `${data.length} plantões no período` : 'Seus plantões'}
          </p>
        </div>

        {podeCriar && (
          <Link to="/plantoes/novo" className={estilosBotao({ className: 'gap-2' })}>
            <Plus className="size-5" aria-hidden="true" />
            Novo plantão
          </Link>
        )}
      </header>

      {/* Controles do calendário */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => navegar(-1)}
            className="touch-target grid place-items-center rounded-lg border border-border-strong bg-surface text-ink-muted hover:bg-surface-muted"
            aria-label="Período anterior"
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => navegar(1)}
            className="touch-target grid place-items-center rounded-lg border border-border-strong bg-surface text-ink-muted hover:bg-surface-muted"
            aria-label="Próximo período"
          >
            <ChevronRight className="size-5" aria-hidden="true" />
          </button>
        </div>

        <p className="flex-1 text-lg font-semibold text-ink" aria-live="polite">
          {visao === 'dia' ? rotuloDia(referencia) : rotuloMes(referencia)}
        </p>

        <Button variante="secondary" tamanho="sm" onClick={() => setReferencia(hoje)}>
          Hoje
        </Button>

        <div
          className="flex rounded-xl border border-border-strong bg-surface p-0.5"
          role="group"
          aria-label="Visualização"
        >
          {(['mes', 'semana', 'dia'] as const).map((opcao) => (
            <button
              key={opcao}
              type="button"
              onClick={() => setVisao(opcao)}
              aria-pressed={visao === opcao}
              className={cn(
                'min-h-10 rounded-lg px-3 text-sm font-medium transition-colors',
                visao === opcao
                  ? 'bg-brand-700 text-white dark:bg-brand-500 dark:text-brand-950'
                  : 'text-ink-muted hover:text-ink',
              )}
            >
              {opcao === 'mes' ? 'Mês' : opcao === 'semana' ? 'Semana' : 'Dia'}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <ListaSkeleton linhas={4} />
      ) : isError ? (
        <EstadoErro erro={error} aoTentarNovamente={() => void refetch()} />
      ) : visao === 'mes' ? (
        <GradeMensal
          dias={dias}
          referencia={referencia}
          hoje={hoje}
          porDia={porDia}
          aoEscolherDia={(dia) => {
            setReferencia(dia)
            setVisao('dia')
          }}
        />
      ) : (
        <ListaDeDias dias={dias} hoje={hoje} porDia={porDia} podeCriar={podeCriar} />
      )}
    </div>
  )
}

/**
 * Grade do mês.
 *
 * No celular cada célula mostra só pontinhos coloridos com a contagem — texto de
 * 9px numa célula de 40px é ilegível para quem tem 50 anos. O detalhe vem ao
 * tocar no dia, que abre a visão diária.
 */
function GradeMensal({
  dias,
  referencia,
  hoje,
  porDia,
  aoEscolherDia,
}: {
  dias: string[]
  referencia: string
  hoje: string
  porDia: Map<string, Plantao[]>
  aoEscolherDia: (dia: string) => void
}) {
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border bg-surface-muted">
        {SIGLAS_SEMANA.map((sigla, i) => (
          <div
            key={i}
            className="py-2 text-center text-xs font-semibold text-ink-muted"
            aria-hidden="true"
          >
            {sigla}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {dias.map((dia) => {
          const plantoes = porDia.get(dia) ?? []
          const doMes = mesmoMes(dia, referencia)
          const ehHoje = dia === hoje

          return (
            <button
              key={dia}
              type="button"
              onClick={() => aoEscolherDia(dia)}
              aria-label={`${rotuloDia(dia)}, ${plantoes.length} plantões`}
              className={cn(
                'flex min-h-16 flex-col items-center gap-1 border-r border-b border-border p-1.5',
                'transition-colors hover:bg-surface-muted',
                !doMes && 'opacity-40',
              )}
            >
              <span
                className={cn(
                  'tabular grid size-7 place-items-center rounded-full text-sm',
                  ehHoje
                    ? 'bg-brand-700 font-bold text-white dark:bg-brand-500 dark:text-brand-950'
                    : 'text-ink',
                )}
              >
                {Number(dia.slice(8))}
              </span>

              {plantoes.length > 0 && (
                <span className="flex flex-wrap justify-center gap-0.5">
                  {plantoes.slice(0, 3).map((p) => (
                    <span
                      key={p.id}
                      className={cn('size-1.5 rounded-full', STATUS_PLANTAO[p.status].cor)}
                      aria-hidden="true"
                    />
                  ))}
                  {plantoes.length > 3 && (
                    <span className="text-[10px] leading-none text-ink-muted">
                      +{plantoes.length - 3}
                    </span>
                  )}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </Card>
  )
}

function ListaDeDias({
  dias,
  hoje,
  porDia,
  podeCriar,
}: {
  dias: string[]
  hoje: string
  porDia: Map<string, Plantao[]>
  podeCriar: boolean
}) {
  const temAlgum = dias.some((dia) => (porDia.get(dia)?.length ?? 0) > 0)

  if (!temAlgum) {
    return (
      <EstadoVazio
        titulo="Nenhum plantão neste período"
        descricao={
          podeCriar
            ? 'Agende um plantão para começar a montar sua rotina.'
            : 'Ainda não há plantões marcados aqui.'
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {dias.map((dia) => {
        const plantoes = porDia.get(dia) ?? []
        if (plantoes.length === 0) return null

        return (
          <section key={dia}>
            <h2
              className={cn(
                'mb-2 text-sm font-semibold',
                dia === hoje ? 'text-brand-700 dark:text-brand-300' : 'text-ink-muted',
              )}
            >
              {dia === hoje ? `Hoje · ${rotuloDia(dia)}` : rotuloDia(dia)}
            </h2>
            <ul className="flex flex-col gap-2">
              {plantoes.map((plantao) => (
                <li key={plantao.id}>
                  <CartaoPlantao plantao={plantao} />
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

export function CartaoPlantao({ plantao }: { plantao: Plantao }) {
  const status = STATUS_PLANTAO[plantao.status]
  const cancelado = plantao.status === 'CANCELED'

  return (
    <Link
      to={`/plantoes/${plantao.id}`}
      className={cn(
        'flex min-h-18 gap-3 rounded-card border border-border bg-surface p-3 transition-colors hover:bg-surface-muted',
        cancelado && 'opacity-60',
      )}
    >
      {/* Barra de status: a cor é reforço, o rótulo abaixo é a informação */}
      <span className={cn('w-1 shrink-0 rounded-full', status.cor)} aria-hidden="true" />

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="tabular font-semibold text-ink">
            {formatarHora(plantao.startsAt)} – {formatarHora(plantao.endsAt)}
          </span>
          <span className="text-sm text-ink-muted">{plantao.hours}h</span>
        </span>

        <span className={cn('mt-0.5 block truncate text-ink', cancelado && 'line-through')}>
          {plantao.customerName}
        </span>

        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="text-ink-muted">{status.rotulo}</span>
          {plantao.caregiverName ? (
            <span className="text-ink-muted">{plantao.caregiverName}</span>
          ) : (
            <span className="font-medium text-warning">Sem cuidador</span>
          )}
          <span className="tabular text-ink-muted">{formatarDinheiro(plantao.chargeAmount)}</span>
        </span>
      </span>
    </Link>
  )
}
