import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Phone, Plus } from 'lucide-react'
import { useAuth } from '@/features/auth/auth.store'
import { formatarDinheiro, formatarTelefone, iniciais } from '@/shared/lib/format'
import { estilosBotao } from '@/shared/ui/button.styles'
import { Badge } from '@/shared/ui/Card'
import { EstadoErro, EstadoVazio, ListaSkeleton, SemPermissao } from '@/shared/ui/feedback'
import { TIPOS_CONTRATO, useCaregivers } from './cuidadores.api'

export default function CuidadoresPage() {
  const [busca, setBusca] = useState('')
  const pode = useAuth((e) => e.pode)
  const somenteLeitura = useAuth((e) => e.somenteLeitura)

  const { data, isLoading, isError, error, refetch } = useCaregivers({
    status: 'all',
    q: busca || undefined,
  })

  if (!pode('caregivers:read')) return <SemPermissao />

  const cuidadores = data?.data ?? []
  const podeCriar = pode('caregivers:write') && !somenteLeitura()

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Cuidadores</h1>
          <p className="mt-0.5 text-ink-muted">
            Sua equipe, com valores e disponibilidade de cada um.
          </p>
        </div>

        {podeCriar && (
          <Link to="/cuidadores/novo" className={estilosBotao({ className: 'gap-2' })}>
            <Plus className="size-5" aria-hidden="true" />
            Novo cuidador
          </Link>
        )}
      </header>

      <input
        type="search"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por nome, CPF ou telefone"
        aria-label="Buscar cuidadores"
        className="min-h-12 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-base text-ink placeholder:text-ink-subtle"
      />

      {isLoading ? (
        <ListaSkeleton linhas={3} />
      ) : isError ? (
        <EstadoErro erro={error} aoTentarNovamente={() => void refetch()} />
      ) : cuidadores.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum cuidador cadastrado"
          descricao="Cadastre sua equipe para conseguir montar escalas e acompanhar quanto cada plantão custa."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {cuidadores.map((cuidador) => (
            <li key={cuidador.id}>
              <Link
                to={`/cuidadores/${cuidador.id}`}
                className="flex min-h-16 items-center gap-3 rounded-card border border-border bg-surface p-3 transition-colors hover:bg-surface-muted"
              >
                <span
                  className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-bold text-brand-800 dark:bg-brand-900 dark:text-brand-100"
                  aria-hidden="true"
                >
                  {iniciais(cuidador.name)}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-semibold text-ink">{cuidador.name}</span>
                    {/* O titular precisa ser reconhecível: na conta individual
                        ele é o único, e na empresa não pode ser removido. */}
                    {cuidador.isOwner && <Badge tom="marca">Você</Badge>}
                    {!cuidador.isActive && <Badge tom="neutro">Inativo</Badge>}
                  </span>

                  <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-ink-muted">
                    {cuidador.phone && (
                      <span className="tabular flex items-center gap-1">
                        <Phone className="size-3.5 shrink-0" aria-hidden="true" />
                        {formatarTelefone(cuidador.phone)}
                      </span>
                    )}
                    {cuidador.contractType && (
                      <span>{TIPOS_CONTRATO[cuidador.contractType] ?? cuidador.contractType}</span>
                    )}
                    {cuidador.shiftRate && (
                      <span className="tabular">
                        {formatarDinheiro(cuidador.shiftRate)}/plantão
                      </span>
                    )}
                  </span>
                </span>

                <ChevronRight className="size-5 shrink-0 text-ink-subtle" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
