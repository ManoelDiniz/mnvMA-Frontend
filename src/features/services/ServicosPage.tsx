import { Link } from 'react-router-dom'
import { ChevronRight, Plus } from 'lucide-react'
import { useAuth } from '@/features/auth/auth.store'
import { formatarDinheiro } from '@/shared/lib/format'
import { estilosBotao } from '@/shared/ui/button.styles'
import { Badge } from '@/shared/ui/Card'
import { EstadoErro, EstadoVazio, ListaSkeleton, SemPermissao } from '@/shared/ui/feedback'
import { ROTULO_UNIDADE, useServicos } from './servicos.api'

export default function ServicosPage() {
  const pode = useAuth((e) => e.pode)
  const somenteLeitura = useAuth((e) => e.somenteLeitura)
  const empresa = useAuth((e) => e.conta?.type === 'COMPANY')

  const { data, isLoading, isError, error, refetch } = useServicos({ status: 'all' })

  if (!pode('services:read')) return <SemPermissao />

  const servicos = data?.data ?? []
  const podeCriar = pode('services:write') && !somenteLeitura()

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Serviços</h1>
          <p className="mt-0.5 text-ink-muted">
            {empresa
              ? 'Quanto você cobra e quanto paga ao cuidador em cada tipo de atendimento.'
              : 'Os tipos de atendimento que você faz e quanto cobra por cada um.'}
          </p>
        </div>

        {podeCriar && (
          <Link to="/servicos/novo" className={estilosBotao({ className: 'gap-2' })}>
            <Plus className="size-5" aria-hidden="true" />
            Novo serviço
          </Link>
        )}
      </header>

      {isLoading ? (
        <ListaSkeleton linhas={3} />
      ) : isError ? (
        <EstadoErro erro={error} aoTentarNovamente={() => void refetch()} />
      ) : servicos.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum serviço cadastrado"
          descricao={
            empresa
              ? 'Cadastre "Cuidador 12h diurno", "Plantão noturno" e afins, com o valor cobrado e o valor pago ao cuidador.'
              : 'Cadastre os plantões que você faz — 12h, 24h, acompanhamento — com o valor que cobra.'
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {servicos.map((servico) => (
            <li key={servico.id}>
              <Link
                to={`/servicos/${servico.id}`}
                className="flex min-h-16 items-center gap-3 rounded-card border border-border bg-surface p-3.5 transition-colors hover:bg-surface-muted"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink">{servico.name}</span>
                    {servico.code && (
                      <span className="tabular text-xs text-ink-subtle">{servico.code}</span>
                    )}
                    {!servico.isActive && <Badge tom="neutro">Inativo</Badge>}
                  </span>

                  <span className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm">
                    <span className="tabular font-semibold text-ink">
                      {formatarDinheiro(servico.salePrice)}
                    </span>
                    <span className="text-ink-muted">{ROTULO_UNIDADE[servico.unit]}</span>

                    {/* Margem só faz sentido quando existe custo com terceiro.
                        Na conta individual o valor todo é do próprio cuidador. */}
                    {servico.caregiverCost && (
                      <span className="tabular text-ink-muted">
                        custo {formatarDinheiro(servico.caregiverCost)} · sobra{' '}
                        <span className="font-medium text-success">
                          {formatarDinheiro(servico.margin)}
                        </span>
                        {servico.marginPercent !== null && ` (${servico.marginPercent}%)`}
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
