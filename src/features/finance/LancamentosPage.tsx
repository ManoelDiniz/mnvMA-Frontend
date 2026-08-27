import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, Check, ChevronLeft, ChevronRight, Plus, Undo2 } from 'lucide-react'
import { useAuth } from '@/features/auth/auth.store'
import { primeiroDiaDoMes, hojeChave, rotuloMes, somarMeses, ultimoDiaDoMes } from '@/features/shifts/calendario'
import { ApiError } from '@/shared/api/client'
import { cn } from '@/shared/lib/cn'
import { formatarData, formatarDinheiro } from '@/shared/lib/format'
import { Button } from '@/shared/ui/Button'
import { estilosBotao } from '@/shared/ui/button.styles'
import { Badge, Card, CardBody } from '@/shared/ui/Card'
import { InputField } from '@/shared/ui/Field'
import { EstadoErro, EstadoVazio, ListaSkeleton, SemPermissao } from '@/shared/ui/feedback'
import {
  CATEGORIAS,
  STATUS_LANCAMENTO,
  useBaixar,
  useDesfazerBaixa,
  useLancamentos,
  useResumoFinanceiro,
  type LadoFinanceiro,
  type Lancamento,
} from './financeiro.api'

const FILTROS = [
  { chave: 'aberto', rotulo: 'Em aberto', status: 'PENDING,OVERDUE,FORECAST' },
  { chave: 'vencido', rotulo: 'Vencidos', status: 'OVERDUE' },
  { chave: 'quitado', rotulo: 'Quitados', status: 'PAID' },
  { chave: 'todos', rotulo: 'Todos', status: 'all' },
] as const

export default function LancamentosPage({ lado }: { lado: LadoFinanceiro }) {
  const receber = lado === 'receber'
  const [mes, setMes] = useState(() => primeiroDiaDoMes(hojeChave()))
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]['chave']>('aberto')

  const pode = useAuth((e) => e.pode)
  const somenteLeitura = useAuth((e) => e.somenteLeitura)

  const periodo = useMemo(
    () => ({ from: primeiroDiaDoMes(mes), to: ultimoDiaDoMes(mes) }),
    [mes],
  )

  const status = FILTROS.find((f) => f.chave === filtro)!.status
  const { data, isLoading, isError, error, refetch } = useLancamentos(lado, { ...periodo, status })
  const { data: resumo } = useResumoFinanceiro(periodo.from, periodo.to)

  if (!pode('finance:read')) return <SemPermissao />

  const lancamentos = data ?? []
  const podeMexer = pode('finance:write') && !somenteLeitura()

  const emAberto = receber ? resumo?.toReceive : resumo?.toPay
  const quitado = receber ? resumo?.received : resumo?.paid
  const vencido = receber ? resumo?.overdueReceivable : resumo?.overduePayable

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            {receber ? 'Contas a receber' : 'Contas a pagar'}
          </h1>
          <p className="mt-0.5 text-ink-muted">
            {receber ? 'Dinheiro que tem a entrar' : 'Dinheiro que tem a sair'}
          </p>
        </div>

        {podeMexer && (
          <Link
            to={`/financeiro/${lado}/novo`}
            className={estilosBotao({ className: 'gap-2' })}
          >
            <Plus className="size-5" aria-hidden="true" />
            Novo lançamento
          </Link>
        )}
      </header>

      {/* Navegação por mês: o financeiro deste setor é fechado mês a mês */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMes(somarMeses(mes, -1))}
          className="touch-target grid place-items-center rounded-lg border border-border-strong bg-surface text-ink-muted hover:bg-surface-muted"
          aria-label="Mês anterior"
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>
        <p className="flex-1 text-center text-lg font-semibold text-ink" aria-live="polite">
          {rotuloMes(mes)}
        </p>
        <button
          type="button"
          onClick={() => setMes(somarMeses(mes, 1))}
          className="touch-target grid place-items-center rounded-lg border border-border-strong bg-surface text-ink-muted hover:bg-surface-muted"
          aria-label="Próximo mês"
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </button>
      </div>

      {/* Previsto e realizado lado a lado, nunca somados: "a receber" e "na
          conta" são perguntas diferentes, e misturar as duas faz alguém contar
          com dinheiro que ainda não entrou. */}
      <div className="grid grid-cols-3 gap-2">
        <Totalizador rotulo={receber ? 'A receber' : 'A pagar'} valor={emAberto} tom="neutro" />
        <Totalizador
          rotulo={receber ? 'Recebido' : 'Pago'}
          valor={quitado}
          tom="sucesso"
        />
        <Totalizador rotulo="Vencido" valor={vencido} tom="perigo" />
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Filtrar por situação">
        {FILTROS.map((opcao) => (
          <button
            key={opcao.chave}
            type="button"
            onClick={() => setFiltro(opcao.chave)}
            aria-pressed={filtro === opcao.chave}
            className={cn(
              'min-h-10 shrink-0 rounded-full border px-3.5 text-sm font-medium transition-colors',
              filtro === opcao.chave
                ? 'border-brand-600 bg-brand-50 text-brand-800 dark:bg-brand-900 dark:text-brand-100'
                : 'border-border-strong bg-surface text-ink-muted hover:bg-surface-muted',
            )}
          >
            {opcao.rotulo}
          </button>
        ))}
      </div>

      {isLoading ? (
        <ListaSkeleton linhas={4} />
      ) : isError ? (
        <EstadoErro erro={error} aoTentarNovamente={() => void refetch()} />
      ) : lancamentos.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum lançamento aqui"
          descricao={
            receber
              ? 'Plantões concluídos viram cobranças automaticamente. Você também pode lançar à mão.'
              : 'Plantões concluídos geram o pagamento do cuidador. Outras despesas você lança à mão.'
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {lancamentos.map((item) => (
            <li key={item.id}>
              <CartaoLancamento lado={lado} item={item} podeMexer={podeMexer} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Totalizador({
  rotulo,
  valor,
  tom,
}: {
  rotulo: string
  valor?: string
  tom: 'neutro' | 'sucesso' | 'perigo'
}) {
  const zerado = !valor || Number(valor) === 0
  return (
    <Card className="p-3">
      <p className="text-xs font-medium text-ink-muted">{rotulo}</p>
      <p
        className={cn(
          'tabular mt-1 text-base font-bold sm:text-lg',
          zerado
            ? 'text-ink-subtle'
            : tom === 'sucesso'
              ? 'text-success'
              : tom === 'perigo'
                ? 'text-danger'
                : 'text-ink',
        )}
      >
        {formatarDinheiro(valor ?? 0)}
      </p>
    </Card>
  )
}

function CartaoLancamento({
  lado,
  item,
  podeMexer,
}: {
  lado: LadoFinanceiro
  item: Lancamento
  podeMexer: boolean
}) {
  const [abrindoBaixa, setAbrindoBaixa] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [data, setData] = useState(() => hojeChave())
  const [valor, setValor] = useState(item.amount)

  const baixar = useBaixar(lado)
  const desfazer = useDesfazerBaixa(lado)

  const status = STATUS_LANCAMENTO[item.status]
  const quitado = item.status === 'PAID'
  const quem = lado === 'receber' ? item.customerName : (item.caregiverName ?? item.supplier)

  async function confirmar() {
    setErro(null)
    try {
      await baixar.mutateAsync({
        id: item.id,
        paidAt: data,
        paidAmount: valor.replace(',', '.'),
      })
      setAbrindoBaixa(false)
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não conseguimos registrar a baixa.')
    }
  }

  return (
    <Card className={cn(quitado && 'opacity-75')}>
      <CardBody className="flex flex-col gap-3 p-3.5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-ink">{item.description}</p>
            <p className="mt-0.5 text-sm text-ink-muted">
              {quem}
              {item.category && lado === 'pagar' && ` · ${CATEGORIAS[item.category]}`}
            </p>

            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <Badge tom={status.tom}>{status.rotulo}</Badge>

              <span className="tabular flex items-center gap-1 text-ink-muted">
                <CalendarClock className="size-3.5" aria-hidden="true" />
                {quitado && item.paidAt
                  ? `pago em ${formatarData(item.paidAt)}`
                  : `vence ${formatarData(item.dueDate)}`}
              </span>

              {/* Atraso em dias: "vencido" sozinho não diz se é de ontem ou de
                  três meses atrás, e a cobrança muda conforme isso. */}
              {item.daysOverdue > 0 && (
                <span className="font-medium text-danger">
                  {item.daysOverdue === 1 ? 'há 1 dia' : `há ${item.daysOverdue} dias`}
                </span>
              )}
            </p>
          </div>

          <div className="text-right">
            <p
              className={cn(
                'tabular text-lg font-bold',
                quitado ? 'text-success' : 'text-ink',
              )}
            >
              {formatarDinheiro(quitado ? (item.paidAmount ?? item.amount) : item.amount)}
            </p>
            {/* Pagou diferente do previsto? Mostra os dois — desconto e juros
                são rotina, e esconder a diferença faz o cliente questionar. */}
            {quitado && item.paidAmount && item.paidAmount !== item.amount && (
              <p className="tabular text-xs text-ink-muted line-through">
                {formatarDinheiro(item.amount)}
              </p>
            )}
          </div>
        </div>

        {erro && (
          <p role="alert" className="text-sm text-danger">
            {erro}
          </p>
        )}

        {podeMexer && !abrindoBaixa && (
          <div className="flex gap-2">
            {quitado ? (
              <Button
                variante="ghost"
                tamanho="sm"
                onClick={() => void desfazer.mutateAsync(item.id)}
                carregando={desfazer.isPending}
                iconeEsquerda={<Undo2 className="size-4" aria-hidden="true" />}
              >
                Desfazer baixa
              </Button>
            ) : (
              <Button
                tamanho="sm"
                onClick={() => setAbrindoBaixa(true)}
                iconeEsquerda={<Check className="size-4" aria-hidden="true" />}
              >
                {lado === 'receber' ? 'Registrar recebimento' : 'Registrar pagamento'}
              </Button>
            )}

            {item.shiftId && (
              <Link
                to={`/plantoes/${item.shiftId}`}
                className={estilosBotao({ variante: 'ghost', tamanho: 'sm' })}
              >
                Ver plantão
              </Link>
            )}
          </div>
        )}

        {abrindoBaixa && (
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-muted p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <InputField
                label={lado === 'receber' ? 'Data do recebimento' : 'Data do pagamento'}
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
              <InputField
                label="Valor"
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                ajuda="Ajuste se houve desconto ou juros."
              />
            </div>
            <div className="flex gap-2">
              <Button variante="secondary" onClick={() => setAbrindoBaixa(false)} className="flex-1">
                Cancelar
              </Button>
              <Button onClick={() => void confirmar()} carregando={baixar.isPending} className="flex-[2]">
                Confirmar
              </Button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  )
}
