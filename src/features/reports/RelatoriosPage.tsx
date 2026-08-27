import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { useAuth } from '@/features/auth/auth.store'
import {
  hojeChave,
  primeiroDiaDoMes,
  rotuloMes,
  somarMeses,
  ultimoDiaDoMes,
} from '@/features/shifts/calendario'
import { api, query } from '@/shared/api/client'
import { cn } from '@/shared/lib/cn'
import { formatarDinheiro } from '@/shared/lib/format'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { EstadoErro, EstadoVazio, ListaSkeleton, SemPermissao } from '@/shared/ui/feedback'

type Agrupamento = 'customer' | 'caregiver' | 'service'

interface LinhaRentabilidade {
  id: string | null
  name: string
  shifts: number
  hours: number
  revenue: string
  cost: string
  result: string
  marginPercent: number | null
}

interface Rentabilidade {
  by: Agrupamento
  rows: LinhaRentabilidade[]
  total: Omit<LinhaRentabilidade, 'id' | 'name'>
}

interface Operacional {
  completed: number
  planned: number
  confirmed: number
  inProgress: number
  canceled: number
  noShow: number
  uncovered: number
  hoursWorked: number
  noShowRate: number
}

const PERIODOS = [
  { chave: 'mes', rotulo: 'Este mês', meses: 0 },
  { chave: 'anterior', rotulo: 'Mês passado', meses: -1 },
  { chave: 'trimestre', rotulo: '3 meses', meses: -2 },
] as const

const AGRUPAMENTOS: Array<{ chave: Agrupamento; rotulo: string }> = [
  { chave: 'customer', rotulo: 'Por cliente' },
  { chave: 'caregiver', rotulo: 'Por cuidador' },
  { chave: 'service', rotulo: 'Por serviço' },
]

export default function RelatoriosPage() {
  const [periodo, setPeriodo] = useState<(typeof PERIODOS)[number]['chave']>('mes')
  const [agrupamento, setAgrupamento] = useState<Agrupamento>('customer')

  const pode = useAuth((e) => e.pode)
  const empresa = useAuth((e) => e.conta?.type === 'COMPANY')

  const { from, to, rotulo } = useMemo(() => {
    const opcao = PERIODOS.find((p) => p.chave === periodo)!
    const hoje = hojeChave()
    const inicio = primeiroDiaDoMes(somarMeses(hoje, opcao.meses))
    const fim =
      opcao.chave === 'anterior' ? ultimoDiaDoMes(somarMeses(hoje, -1)) : ultimoDiaDoMes(hoje)
    return {
      from: inicio,
      to: fim,
      rotulo: opcao.chave === 'trimestre' ? `${rotuloMes(inicio)} — ${rotuloMes(fim)}` : rotuloMes(inicio),
    }
  }, [periodo])

  const rentabilidade = useQuery({
    queryKey: ['relatorios', 'rentabilidade', from, to, agrupamento],
    queryFn: ({ signal }) =>
      api.get<Rentabilidade>(`/reports/profitability${query({ from, to, by: agrupamento })}`, {
        signal,
      }),
    enabled: pode('reports:financial'),
  })

  const operacional = useQuery({
    queryKey: ['relatorios', 'operacional', from, to],
    queryFn: ({ signal }) =>
      api.get<Operacional>(`/reports/operations${query({ from, to })}`, { signal }),
  })

  if (!pode('reports:read')) return <SemPermissao />

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Relatórios</h1>
        <p className="mt-0.5 text-ink-muted">
          {empresa
            ? 'Quanto vendeu, quanto custou e quanto sobrou.'
            : 'Quanto você trabalhou e quanto ganhou.'}
        </p>
      </header>

      <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Período">
        {PERIODOS.map((opcao) => (
          <button
            key={opcao.chave}
            type="button"
            onClick={() => setPeriodo(opcao.chave)}
            aria-pressed={periodo === opcao.chave}
            className={cn(
              'min-h-10 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors',
              periodo === opcao.chave
                ? 'border-brand-600 bg-brand-50 text-brand-800 dark:bg-brand-900 dark:text-brand-100'
                : 'border-border-strong bg-surface text-ink-muted hover:bg-surface-muted',
            )}
          >
            {opcao.rotulo}
          </button>
        ))}
      </div>

      <p className="text-sm text-ink-muted" aria-live="polite">
        {rotulo}
      </p>

      <section aria-labelledby="titulo-operacao">
        <h2 id="titulo-operacao" className="mb-3 text-lg font-semibold text-ink">
          Operação
        </h2>

        {operacional.isLoading ? (
          <ListaSkeleton linhas={2} />
        ) : operacional.isError ? (
          <EstadoErro aoTentarNovamente={() => void operacional.refetch()} />
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Numero rotulo="Plantões realizados" valor={operacional.data!.completed} />
            <Numero rotulo="Horas trabalhadas" valor={`${operacional.data!.hoursWorked}h`} />
            <Numero
              rotulo="Faltas"
              valor={operacional.data!.noShow}
              detalhe={
                operacional.data!.noShowRate > 0
                  ? `${operacional.data!.noShowRate}% do previsto`
                  : undefined
              }
              tom={operacional.data!.noShow > 0 ? 'perigo' : 'neutro'}
            />
            <Numero
              rotulo="Sem cuidador"
              valor={operacional.data!.uncovered}
              tom={operacional.data!.uncovered > 0 ? 'aviso' : 'neutro'}
            />
          </div>
        )}
      </section>

      {pode('reports:financial') && (
        <section aria-labelledby="titulo-rentabilidade">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="titulo-rentabilidade" className="text-lg font-semibold text-ink">
              Rentabilidade
            </h2>

            {rentabilidade.data && rentabilidade.data.rows.length > 0 && (
              <Button
                variante="secondary"
                tamanho="sm"
                iconeEsquerda={<Download className="size-4" aria-hidden="true" />}
                onClick={() => baixarCsv(rentabilidade.data, agrupamento, from, to)}
              >
                Baixar CSV
              </Button>
            )}
          </div>

          <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Agrupar por">
            {AGRUPAMENTOS.filter((a) => empresa || a.chave !== 'caregiver').map((opcao) => (
              <button
                key={opcao.chave}
                type="button"
                onClick={() => setAgrupamento(opcao.chave)}
                aria-pressed={agrupamento === opcao.chave}
                className={cn(
                  'min-h-10 shrink-0 rounded-full border px-3.5 text-sm font-medium transition-colors',
                  agrupamento === opcao.chave
                    ? 'border-brand-600 bg-brand-50 text-brand-800 dark:bg-brand-900 dark:text-brand-100'
                    : 'border-border-strong bg-surface text-ink-muted hover:bg-surface-muted',
                )}
              >
                {opcao.rotulo}
              </button>
            ))}
          </div>

          {rentabilidade.isLoading ? (
            <ListaSkeleton linhas={3} />
          ) : rentabilidade.isError ? (
            <EstadoErro aoTentarNovamente={() => void rentabilidade.refetch()} />
          ) : rentabilidade.data!.rows.length === 0 ? (
            <EstadoVazio
              titulo="Nenhum plantão concluído no período"
              descricao="A rentabilidade conta só o que foi realizado — plantão planejado ainda não é receita."
            />
          ) : (
            <TabelaRentabilidade dados={rentabilidade.data!} empresa={empresa} />
          )}
        </section>
      )}
    </div>
  )
}

/**
 * No celular vira lista de cartões; no desktop, tabela.
 *
 * Tabela com sete colunas e rolagem lateral num telefone é ilegível — e este é
 * exatamente o relatório que alguém abre no ônibus para conferir o mês.
 */
function TabelaRentabilidade({ dados, empresa }: { dados: Rentabilidade; empresa: boolean }) {
  return (
    <Card>
      {/* Celular */}
      <div className="flex flex-col divide-y divide-border lg:hidden">
        {dados.rows.map((linha) => (
          <div key={linha.id ?? linha.name} className="flex flex-col gap-2 p-3.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold text-ink">{linha.name}</span>
              <span
                className={cn(
                  'tabular font-bold',
                  Number(linha.result) >= 0 ? 'text-success' : 'text-danger',
                )}
              >
                {formatarDinheiro(linha.result)}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
              <span>
                {linha.shifts} {linha.shifts === 1 ? 'plantão' : 'plantões'} · {linha.hours}h
              </span>
              <span className="tabular">receita {formatarDinheiro(linha.revenue)}</span>
              {empresa && <span className="tabular">custo {formatarDinheiro(linha.cost)}</span>}
              {empresa && linha.marginPercent !== null && (
                <span className="tabular font-medium">{linha.marginPercent}% de margem</span>
              )}
            </div>
          </div>
        ))}
        <Totais dados={dados} empresa={empresa} />
      </div>

      {/* Desktop */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-ink-muted">
              <th scope="col" className="px-4 py-3 font-medium">
                {dados.by === 'customer' ? 'Cliente' : dados.by === 'caregiver' ? 'Cuidador' : 'Serviço'}
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Plantões</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Horas</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Receita</th>
              {empresa && (
                <th scope="col" className="px-4 py-3 text-right font-medium">Custo</th>
              )}
              <th scope="col" className="px-4 py-3 text-right font-medium">
                {empresa ? 'Sobrou' : 'Total'}
              </th>
              {empresa && (
                <th scope="col" className="px-4 py-3 text-right font-medium">Margem</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {dados.rows.map((linha) => (
              <tr key={linha.id ?? linha.name} className="hover:bg-surface-muted">
                <td className="px-4 py-3 font-medium text-ink">{linha.name}</td>
                <td className="tabular px-4 py-3 text-right text-ink-muted">{linha.shifts}</td>
                <td className="tabular px-4 py-3 text-right text-ink-muted">{linha.hours}</td>
                <td className="tabular px-4 py-3 text-right text-ink">
                  {formatarDinheiro(linha.revenue)}
                </td>
                {empresa && (
                  <td className="tabular px-4 py-3 text-right text-ink-muted">
                    {formatarDinheiro(linha.cost)}
                  </td>
                )}
                <td
                  className={cn(
                    'tabular px-4 py-3 text-right font-semibold',
                    Number(linha.result) >= 0 ? 'text-success' : 'text-danger',
                  )}
                >
                  {formatarDinheiro(linha.result)}
                </td>
                {empresa && (
                  <td className="tabular px-4 py-3 text-right text-ink-muted">
                    {linha.marginPercent === null ? '—' : `${linha.marginPercent}%`}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border-strong font-semibold">
              <td className="px-4 py-3 text-ink">Total</td>
              <td className="tabular px-4 py-3 text-right text-ink">{dados.total.shifts}</td>
              <td className="tabular px-4 py-3 text-right text-ink">{dados.total.hours}</td>
              <td className="tabular px-4 py-3 text-right text-ink">
                {formatarDinheiro(dados.total.revenue)}
              </td>
              {empresa && (
                <td className="tabular px-4 py-3 text-right text-ink">
                  {formatarDinheiro(dados.total.cost)}
                </td>
              )}
              <td
                className={cn(
                  'tabular px-4 py-3 text-right',
                  Number(dados.total.result) >= 0 ? 'text-success' : 'text-danger',
                )}
              >
                {formatarDinheiro(dados.total.result)}
              </td>
              {empresa && (
                <td className="tabular px-4 py-3 text-right text-ink">
                  {dados.total.marginPercent === null ? '—' : `${dados.total.marginPercent}%`}
                </td>
              )}
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  )
}

function Totais({ dados, empresa }: { dados: Rentabilidade; empresa: boolean }) {
  return (
    <div className="flex flex-col gap-2 bg-surface-muted p-3.5">
      <div className="flex items-baseline justify-between">
        <span className="font-semibold text-ink">Total</span>
        <span
          className={cn(
            'tabular text-lg font-bold',
            Number(dados.total.result) >= 0 ? 'text-success' : 'text-danger',
          )}
        >
          {formatarDinheiro(dados.total.result)}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
        <span>
          {dados.total.shifts} plantões · {dados.total.hours}h
        </span>
        <span className="tabular">receita {formatarDinheiro(dados.total.revenue)}</span>
        {empresa && <span className="tabular">custo {formatarDinheiro(dados.total.cost)}</span>}
      </div>
    </div>
  )
}

function Numero({
  rotulo,
  valor,
  detalhe,
  tom = 'neutro',
}: {
  rotulo: string
  valor: number | string
  detalhe?: string
  tom?: 'neutro' | 'aviso' | 'perigo'
}) {
  return (
    <Card className="p-4">
      <p className="text-sm font-medium text-ink-muted">{rotulo}</p>
      <p
        className={cn(
          'tabular mt-1 text-2xl font-bold',
          tom === 'perigo' ? 'text-danger' : tom === 'aviso' ? 'text-warning' : 'text-ink',
        )}
      >
        {valor}
      </p>
      {detalhe && <p className="mt-0.5 text-sm text-ink-muted">{detalhe}</p>}
    </Card>
  )
}

/**
 * CSV com separador `;` e vírgula decimal — é o que o Excel em português abre
 * sem pedir configuração. Com `,` e ponto, tudo cai numa coluna só e a pessoa
 * conclui que o sistema exportou errado.
 */
function baixarCsv(dados: Rentabilidade, por: Agrupamento, de: string, ate: string) {
  const titulo = por === 'customer' ? 'Cliente' : por === 'caregiver' ? 'Cuidador' : 'Servico'
  const decimal = (v: string) => v.replace('.', ',')

  const linhas = [
    [titulo, 'Plantoes', 'Horas', 'Receita', 'Custo', 'Resultado', 'Margem %'],
    ...dados.rows.map((l) => [
      l.name,
      String(l.shifts),
      String(l.hours).replace('.', ','),
      decimal(l.revenue),
      decimal(l.cost),
      decimal(l.result),
      l.marginPercent === null ? '' : String(l.marginPercent).replace('.', ','),
    ]),
    [
      'TOTAL',
      String(dados.total.shifts),
      String(dados.total.hours).replace('.', ','),
      decimal(dados.total.revenue),
      decimal(dados.total.cost),
      decimal(dados.total.result),
      dados.total.marginPercent === null ? '' : String(dados.total.marginPercent).replace('.', ','),
    ],
  ]

  const csv = linhas
    .map((linha) => linha.map((celula) => `"${celula.replace(/"/g, '""')}"`).join(';'))
    .join('\r\n')

  // BOM UTF-8: sem ele o Excel abre "José" como "JosÃ©".
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `mnvma-rentabilidade-${por}-${de}-a-${ate}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
