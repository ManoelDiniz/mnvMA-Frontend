import { useMemo, useState } from 'react'
import { useAuth } from '@/features/auth/auth.store'
import { hojeChave, primeiroDiaDoMes, somarMeses, ultimoDiaDoMes } from '@/features/shifts/calendario'
import { cn } from '@/shared/lib/cn'
import { formatarDinheiro } from '@/shared/lib/format'
import { Card, CardBody, CardHeader } from '@/shared/ui/Card'
import { EstadoErro, EstadoVazio, ListaSkeleton, SemPermissao } from '@/shared/ui/feedback'
import { useFluxoCaixa, useResumoFinanceiro, type PontoFluxo } from './financeiro.api'

const PERIODOS = [
  { chave: '3m', rotulo: '3 meses', meses: 3 },
  { chave: '6m', rotulo: '6 meses', meses: 6 },
  { chave: '12m', rotulo: '12 meses', meses: 12 },
] as const

export default function FluxoCaixaPage() {
  const [periodo, setPeriodo] = useState<(typeof PERIODOS)[number]['chave']>('6m')
  const pode = useAuth((e) => e.pode)

  const meses = PERIODOS.find((p) => p.chave === periodo)!.meses
  const hoje = hojeChave()
  const from = primeiroDiaDoMes(somarMeses(hoje, -(meses - 1)))
  const to = ultimoDiaDoMes(hoje)

  const { data, isLoading, isError, error, refetch } = useFluxoCaixa(from, to, 'month')
  const { data: resumo } = useResumoFinanceiro(from, to)

  // `data ?? []` cria array novo a cada render e invalidaria o memo sempre;
  // depender de `data` direto mantém o cálculo estável.
  const totais = useMemo(() => {
    let entrou = 0
    let saiu = 0
    for (const p of data ?? []) {
      entrou += Number(p.income)
      saiu += Number(p.expense)
    }
    return { entrou, saiu, saldo: entrou - saiu }
  }, [data])

  const pontos = data ?? []

  if (!pode('finance:read')) return <SemPermissao />

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Fluxo de caixa</h1>
        <p className="mt-0.5 text-ink-muted">
          O dinheiro que realmente entrou e saiu — pela data do pagamento, não do vencimento.
        </p>
      </header>

      <div className="flex gap-1.5" role="group" aria-label="Período">
        {PERIODOS.map((opcao) => (
          <button
            key={opcao.chave}
            type="button"
            onClick={() => setPeriodo(opcao.chave)}
            aria-pressed={periodo === opcao.chave}
            className={cn(
              'min-h-10 rounded-full border px-4 text-sm font-medium transition-colors',
              periodo === opcao.chave
                ? 'border-brand-600 bg-brand-50 text-brand-800 dark:bg-brand-900 dark:text-brand-100'
                : 'border-border-strong bg-surface text-ink-muted hover:bg-surface-muted',
            )}
          >
            {opcao.rotulo}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Total rotulo="Entrou" valor={totais.entrou} tom="sucesso" />
        <Total rotulo="Saiu" valor={totais.saiu} tom="perigo" />
        <Total rotulo="Sobrou" valor={totais.saldo} tom={totais.saldo >= 0 ? 'sucesso' : 'perigo'} />
      </div>

      {isLoading ? (
        <ListaSkeleton linhas={4} />
      ) : isError ? (
        <EstadoErro erro={error} aoTentarNovamente={() => void refetch()} />
      ) : pontos.length === 0 ? (
        <EstadoVazio
          titulo="Nada movimentou ainda"
          descricao="Assim que você registrar recebimentos e pagamentos, o fluxo aparece aqui."
        />
      ) : (
        <Card>
          <CardHeader titulo="Mês a mês" />
          <CardBody className="pt-2">
            <GraficoBarras pontos={pontos} />
          </CardBody>
        </Card>
      )}

      {resumo && (
        <Card>
          <CardHeader
            titulo="Previsto para o período"
            descricao="O que ainda não circulou, mas está lançado."
          />
          <CardBody className="grid grid-cols-2 gap-4 pt-2 sm:grid-cols-4">
            <Previsto rotulo="A receber" valor={resumo.toReceive} />
            <Previsto rotulo="A pagar" valor={resumo.toPay} />
            <Previsto rotulo="Vencido a receber" valor={resumo.overdueReceivable} alerta />
            <Previsto rotulo="Vencido a pagar" valor={resumo.overduePayable} alerta />
          </CardBody>
        </Card>
      )}
    </div>
  )
}

/**
 * Gráfico de barras em CSS puro.
 *
 * Sem biblioteca de gráfico: são poucos pontos, o dado é simples, e economizar
 * ~45KB no bundle vale mais para quem abre isto no 4G. Cada barra também traz o
 * valor em texto — gráfico sem número não serve para conferir dinheiro, e não
 * seria acessível a leitor de tela.
 */
function GraficoBarras({ pontos }: { pontos: PontoFluxo[] }) {
  const maior = Math.max(
    ...pontos.map((p) => Math.max(Number(p.income), Number(p.expense))),
    1,
  )

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {pontos.map((ponto) => {
          const entrada = Number(ponto.income)
          const saida = Number(ponto.expense)
          const saldo = Number(ponto.balance)

          return (
            <li key={ponto.period} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-ink">{rotuloPeriodo(ponto.period)}</span>
                <span
                  className={cn(
                    'tabular text-sm font-semibold',
                    saldo >= 0 ? 'text-success' : 'text-danger',
                  )}
                >
                  {formatarDinheiro(saldo)}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <Barra
                  rotulo="Entrou"
                  valor={entrada}
                  proporcao={entrada / maior}
                  classe="bg-success"
                />
                <Barra
                  rotulo="Saiu"
                  valor={saida}
                  proporcao={saida / maior}
                  classe="bg-danger"
                />
              </div>
            </li>
          )
        })}
      </ul>

      <p className="flex flex-wrap gap-4 text-xs text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-success" aria-hidden="true" />
          Entrou
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-danger" aria-hidden="true" />
          Saiu
        </span>
      </p>
    </div>
  )
}

function Barra({
  rotulo,
  valor,
  proporcao,
  classe,
}: {
  rotulo: string
  valor: number
  proporcao: number
  classe: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="sr-only">{rotulo}:</span>
      <div className="h-5 flex-1 overflow-hidden rounded bg-surface-muted">
        <div
          className={cn('h-full rounded transition-[width] duration-300', classe)}
          style={{ width: `${Math.max(proporcao * 100, valor > 0 ? 2 : 0)}%` }}
        />
      </div>
      <span className="tabular w-28 shrink-0 text-right text-sm text-ink-muted">
        {formatarDinheiro(valor)}
      </span>
    </div>
  )
}

function Total({
  rotulo,
  valor,
  tom,
}: {
  rotulo: string
  valor: number
  tom: 'sucesso' | 'perigo'
}) {
  return (
    <Card className="p-3">
      <p className="text-xs font-medium text-ink-muted">{rotulo}</p>
      <p
        className={cn(
          'tabular mt-1 text-base font-bold sm:text-xl',
          valor === 0 ? 'text-ink-subtle' : tom === 'sucesso' ? 'text-success' : 'text-danger',
        )}
      >
        {formatarDinheiro(valor)}
      </p>
    </Card>
  )
}

function Previsto({ rotulo, valor, alerta }: { rotulo: string; valor: string; alerta?: boolean }) {
  const zerado = Number(valor) === 0
  return (
    <div>
      <p className="text-sm text-ink-muted">{rotulo}</p>
      <p
        className={cn(
          'tabular text-lg font-semibold',
          zerado ? 'text-ink-subtle' : alerta ? 'text-danger' : 'text-ink',
        )}
      >
        {formatarDinheiro(valor)}
      </p>
    </div>
  )
}

const NOME_MES = new Intl.DateTimeFormat('pt-BR', {
  month: 'short',
  year: '2-digit',
  timeZone: 'America/Sao_Paulo',
})

function rotuloPeriodo(periodo: string): string {
  // "2026-09" → "set/26"; "2026-09-15" → "15/09"
  if (periodo.length === 7) {
    return NOME_MES.format(new Date(`${periodo}-01T12:00:00-03:00`)).replace('. de ', '/')
  }
  return periodo.slice(8) + '/' + periodo.slice(5, 7)
}
