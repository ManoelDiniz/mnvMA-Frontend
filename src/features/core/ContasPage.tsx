import { Link, useSearchParams } from 'react-router-dom'
import { Building2, ChevronRight, Search, User } from 'lucide-react'
import { formatarCentavos, formatarData } from '@/shared/lib/format'
import { Badge, Card } from '@/shared/ui/Card'
import { Selecao } from '@/shared/ui/Selecao'
import { EstadoErro, EstadoVazio, ListaSkeleton } from '@/shared/ui/feedback'
import { Button } from '@/shared/ui/Button'
import type { StatusConta, TipoConta } from '@/shared/api/types'
import { useContas, type ContaResumo } from './core.api'

const TOM_STATUS: Record<StatusConta, 'sucesso' | 'aviso' | 'perigo' | 'neutro' | 'info'> = {
  ACTIVE: 'sucesso',
  TRIAL: 'info',
  PAST_DUE: 'aviso',
  SUSPENDED: 'perigo',
  EXPIRED: 'aviso',
  CANCELED: 'neutro',
}

const ROTULO_STATUS: Record<StatusConta, string> = {
  TRIAL: 'Em teste',
  ACTIVE: 'Ativa',
  PAST_DUE: 'Em atraso',
  SUSPENDED: 'Suspensa',
  EXPIRED: 'Teste vencido',
  CANCELED: 'Cancelada',
}

/**
 * A lista de clientes do SaaS.
 *
 * Os filtros vivem na URL, e não em estado local: o caminho normal de chegar
 * aqui é clicando num número do painel ("6 suspensas"), e esse link precisa
 * abrir já filtrado — além de poder ser guardado nos favoritos e mandado para
 * outra pessoa.
 */
export default function ContasPage() {
  const [busca, setBusca] = useSearchParams()

  const filtro = {
    q: busca.get('q') ?? '',
    status: (busca.get('status') ?? '') as StatusConta | '',
    type: (busca.get('type') ?? '') as TipoConta | '',
    page: Number(busca.get('page') ?? 1),
  }

  const { data, isLoading, isError, error, refetch } = useContas(filtro)

  const trocar = (campo: string, valor: string) => {
    const proximo = new URLSearchParams(busca)
    if (valor) proximo.set(campo, valor)
    else proximo.delete(campo)
    // Qualquer mudança de filtro volta para a primeira página: manter a página 3
    // de um filtro antigo mostra "nenhuma conta" para uma busca que tem
    // resultado.
    proximo.delete('page')
    setBusca(proximo, { replace: true })
  }

  const contas = data?.data ?? []
  const meta = data?.meta

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Contas</h1>
          <p className="mt-0.5 text-ink-muted">
            {meta ? `${meta.total} conta${meta.total === 1 ? '' : 's'} no total` : 'Clientes do MNVMA'}
          </p>
        </div>
      </header>

      <Card className="flex flex-wrap items-end gap-3 p-4">
        <div className="flex min-w-56 flex-1 flex-col gap-1.5">
          <label htmlFor="busca" className="text-sm font-medium text-ink">
            Buscar
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle"
              aria-hidden="true"
            />
            <input
              id="busca"
              defaultValue={filtro.q}
              onBlur={(e) => trocar('q', e.target.value.trim())}
              onKeyDown={(e) => {
                if (e.key === 'Enter') trocar('q', e.currentTarget.value.trim())
              }}
              placeholder="Nome ou documento"
              className="min-h-12 w-full rounded-xl border border-border bg-surface py-2.5 pr-3.5 pl-9 text-base text-ink placeholder:text-ink-subtle"
            />
          </div>
        </div>

        <div className="min-w-44">
          <Selecao
            label="Situação"
            placeholder="Todas"
            value={filtro.status}
            onChange={(e) => trocar('status', e.target.value)}
            opcoes={Object.entries(ROTULO_STATUS).map(([valor, rotulo]) => ({ valor, rotulo }))}
          />
        </div>

        <div className="min-w-40">
          <Selecao
            label="Tipo"
            placeholder="Todos"
            value={filtro.type}
            onChange={(e) => trocar('type', e.target.value)}
            opcoes={[
              { valor: 'INDIVIDUAL', rotulo: 'Individual' },
              { valor: 'COMPANY', rotulo: 'Empresa' },
            ]}
          />
        </div>
      </Card>

      {isLoading ? (
        <ListaSkeleton linhas={5} />
      ) : isError ? (
        <EstadoErro erro={error} aoTentarNovamente={() => void refetch()} />
      ) : contas.length === 0 ? (
        <EstadoVazio
          titulo="Nenhuma conta encontrada"
          descricao="Ajuste a busca ou os filtros para ver outras contas."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {contas.map((conta) => (
            <li key={conta.id}>
              <LinhaDaConta conta={conta} />
            </li>
          ))}
        </ul>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <Button
            variante="secondary"
            tamanho="sm"
            disabled={meta.page <= 1}
            onClick={() => trocarPagina(busca, setBusca, meta.page - 1)}
          >
            Anterior
          </Button>
          <p className="text-sm text-ink-muted">
            Página {meta.page} de {meta.totalPages}
          </p>
          <Button
            variante="secondary"
            tamanho="sm"
            disabled={meta.page >= meta.totalPages}
            onClick={() => trocarPagina(busca, setBusca, meta.page + 1)}
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  )
}

function trocarPagina(
  busca: URLSearchParams,
  setBusca: (p: URLSearchParams, o?: { replace?: boolean }) => void,
  pagina: number,
) {
  const proximo = new URLSearchParams(busca)
  proximo.set('page', String(pagina))
  setBusca(proximo, { replace: true })
}

function LinhaDaConta({ conta }: { conta: ContaResumo }) {
  const Icone = conta.type === 'COMPANY' ? Building2 : User

  return (
    <Link
      to={`/core/contas/${conta.id}`}
      className="flex min-h-16 items-center gap-3 rounded-card border border-border bg-surface p-3.5 transition-colors hover:bg-surface-muted"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-muted">
        <Icone className="size-5 text-ink-muted" aria-hidden="true" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-ink">{conta.name}</p>
        <p className="truncate text-sm text-ink-muted">
          {conta.ownerEmail ?? 'sem titular'} · {conta.users} usuário
          {conta.users === 1 ? '' : 's'}
          {conta.planName ? ` · ${conta.planName}` : ''}
        </p>
      </div>

      <div className="hidden shrink-0 text-right sm:block">
        <p className="tabular font-semibold text-ink">
          {conta.monthlyCents > 0 ? `${formatarCentavos(conta.monthlyCents)}/mês` : '—'}
        </p>
        <p className="text-xs text-ink-subtle">
          {conta.couponCode
            ? `cupom ${conta.couponCode}`
            : conta.trialEndsAt && conta.status === 'TRIAL'
              ? `teste até ${formatarData(conta.trialEndsAt)}`
              : `desde ${formatarData(conta.createdAt)}`}
        </p>
      </div>

      <Badge tom={TOM_STATUS[conta.status]}>{ROTULO_STATUS[conta.status]}</Badge>
      <ChevronRight className="size-5 shrink-0 text-ink-subtle" aria-hidden="true" />
    </Link>
  )
}
