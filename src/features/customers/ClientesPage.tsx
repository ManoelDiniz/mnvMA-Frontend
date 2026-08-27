import { useDeferredValue, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Phone, Plus, Search, Users } from 'lucide-react'
import { useAuth } from '@/features/auth/auth.store'
import { useOnline } from '@/shared/hooks/usePwa'
import { formatarTelefone, iniciais } from '@/shared/lib/format'
import { Badge } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { estilosBotao } from '@/shared/ui/button.styles'
import {
  EstadoErro,
  EstadoOffline,
  EstadoVazio,
  ListaSkeleton,
  SemPermissao,
} from '@/shared/ui/feedback'
import { useClientes } from './clientes.api'

export default function ClientesPage() {
  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(1)
  const online = useOnline()

  const pode = useAuth((e) => e.pode)
  const somenteLeitura = useAuth((e) => e.somenteLeitura)

  // Não bloqueia a digitação enquanto a lista antiga continua na tela.
  const buscaAdiada = useDeferredValue(busca)

  const { data, isLoading, isError, error, refetch, isFetching } = useClientes({
    page: pagina,
    perPage: 25,
    q: buscaAdiada || undefined,
    status: 'active',
  })

  if (!pode('customers:read')) return <SemPermissao />

  const clientes = data?.data ?? []
  const total = data?.meta.total ?? 0
  const podeCriar = pode('customers:write') && !somenteLeitura()

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Clientes</h1>
          <p className="mt-0.5 text-ink-muted">
            {total === 0
              ? 'Quem você atende'
              : `${total} ${total === 1 ? 'cliente cadastrado' : 'clientes cadastrados'}`}
          </p>
        </div>

        {podeCriar && (
          <Link
            to="/clientes/novo"
            className={estilosBotao({ className: 'hidden gap-2 sm:inline-flex' })}
          >
            <Plus className="size-5" aria-hidden="true" />
            Novo cliente
          </Link>
        )}
      </header>

      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-ink-subtle"
          aria-hidden="true"
        />
        <input
          type="search"
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value)
            setPagina(1)
          }}
          placeholder="Buscar por nome, CPF ou telefone"
          aria-label="Buscar clientes"
          className="min-h-12 w-full rounded-xl border border-border-strong bg-surface pr-4 pl-11 text-base text-ink placeholder:text-ink-subtle"
        />
      </div>

      {/* Conteúdo em cache com o aparelho offline: avisa em vez de mentir */}
      {!online && clientes.length > 0 && (
        <p className="rounded-xl border border-warning/30 bg-warning-soft px-3.5 py-2.5 text-sm text-warning">
          Você está sem conexão. Esta lista é a última versão salva no aparelho.
        </p>
      )}

      {isLoading ? (
        <ListaSkeleton />
      ) : isError ? (
        !online ? (
          <EstadoOffline aoTentarNovamente={() => void refetch()} />
        ) : (
          <EstadoErro erro={error} aoTentarNovamente={() => void refetch()} />
        )
      ) : clientes.length === 0 ? (
        buscaAdiada ? (
          <EstadoVazio
            titulo="Nenhum cliente encontrado"
            descricao={`Não achamos ninguém com "${buscaAdiada}". Confira a escrita ou limpe a busca.`}
            acao={{ rotulo: 'Limpar busca', onClick: () => setBusca('') }}
          />
        ) : (
          <EstadoVazio
            titulo="Você ainda não tem clientes"
            descricao="Cadastre quem você atende para começar a montar a agenda e registrar os plantões."
          />
        )
      ) : (
        <ul className="flex flex-col gap-2" aria-busy={isFetching}>
          {clientes.map((cliente) => (
            <li key={cliente.id}>
              <Link
                to={`/clientes/${cliente.id}`}
                className="flex min-h-16 items-center gap-3 rounded-card border border-border bg-surface p-3 transition-colors hover:bg-surface-muted"
              >
                <span
                  className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-bold text-brand-800 dark:bg-brand-900 dark:text-brand-100"
                  aria-hidden="true"
                >
                  {iniciais(cliente.name)}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">{cliente.name}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-muted">
                    {cliente.phone ? (
                      <>
                        <Phone className="size-3.5 shrink-0" aria-hidden="true" />
                        <span className="tabular">{formatarTelefone(cliente.phone)}</span>
                      </>
                    ) : (
                      <span>Sem telefone cadastrado</span>
                    )}
                  </span>
                </span>

                {!cliente.isActive && <Badge tom="neutro">Inativo</Badge>}
                <ChevronRight className="size-5 shrink-0 text-ink-subtle" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {data && data.meta.totalPages > 1 && (
        <nav className="flex items-center justify-between gap-3" aria-label="Paginação">
          <Button
            variante="secondary"
            disabled={pagina <= 1}
            onClick={() => setPagina((p) => p - 1)}
          >
            Anterior
          </Button>
          <span className="text-sm text-ink-muted">
            Página {data.meta.page} de {data.meta.totalPages}
          </span>
          <Button
            variante="secondary"
            disabled={pagina >= data.meta.totalPages}
            onClick={() => setPagina((p) => p + 1)}
          >
            Próxima
          </Button>
        </nav>
      )}

      {/* Botão flutuante: no celular a ação principal precisa estar ao alcance
          do polegar, não no topo da tela. */}
      {podeCriar && (
        <Link
          to="/clientes/novo"
          className="fixed right-4 bottom-24 z-sticky grid size-14 place-items-center rounded-full bg-brand-700 text-white shadow-raised transition-colors hover:bg-brand-800 sm:hidden dark:bg-brand-500 dark:text-brand-950"
          aria-label="Cadastrar novo cliente"
        >
          <Plus className="size-7" aria-hidden="true" />
        </Link>
      )}

      {clientes.length === 0 && !isLoading && !isError && !buscaAdiada && podeCriar && (
        <Link
          to="/clientes/novo"
          className={estilosBotao({ tamanho: 'lg', larguraTotal: true, className: 'gap-2 sm:hidden' })}
        >
          <Users className="size-5" aria-hidden="true" />
          Cadastrar meu primeiro cliente
        </Link>
      )}
    </div>
  )
}
