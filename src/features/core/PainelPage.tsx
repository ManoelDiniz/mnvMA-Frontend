import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Building2,
  Clock,
  Gift,
  TrendingUp,
  User,
  Users,
  Webhook,
} from 'lucide-react'
import { formatarCentavos } from '@/shared/lib/format'
import { Card, Indicador } from '@/shared/ui/Card'
import { EstadoErro, ListaSkeleton } from '@/shared/ui/feedback'
import { useMetricas, type Metricas } from './core.api'

const ROTULO_STATUS: Record<string, string> = {
  TRIAL: 'Em teste',
  ACTIVE: 'Ativas',
  PAST_DUE: 'Em atraso',
  SUSPENDED: 'Suspensas',
  EXPIRED: 'Teste vencido',
  CANCELED: 'Canceladas',
}

/**
 * O painel do dono do SaaS.
 *
 * Responde, em uma tela, as três perguntas que decidem a semana: quanto entra
 * por mês, quem está prestes a sair e o que está quebrado. O resto é detalhe e
 * mora na lista de contas.
 *
 * Duas escolhas deliberadas:
 *
 *   • **MRR já com os cupons descontados.** É o que vai ser cobrado no próximo
 *     ciclo. Mostrar o preço de tabela inflaria a receita justamente durante uma
 *     campanha de desconto, que é quando o número mais importa.
 *   • **Webhook pendente é indicador de primeira linha.** Evento parado é
 *     dinheiro que talvez não tenha sido creditado, e é a métrica que ninguém
 *     pensa em olhar até doer.
 */
export default function PainelPage() {
  const { data, isLoading, isError, error, refetch } = useMetricas()

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-ink">MNVMA Core</h1>
        <p className="mt-0.5 text-ink-muted">
          Os números da plataforma. Só você enxerga esta área.
        </p>
      </header>

      {isLoading ? (
        <ListaSkeleton linhas={3} />
      ) : isError || !data ? (
        <EstadoErro erro={error} aoTentarNovamente={() => void refetch()} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Indicador
              rotulo="Receita recorrente"
              valor={formatarCentavos(data.mrrCents)}
              detalhe={`${data.pagantes} conta${data.pagantes === 1 ? '' : 's'} pagando`}
              tom="sucesso"
              icone={<TrendingUp className="size-5 text-success" aria-hidden="true" />}
            />
            <Indicador
              rotulo="Contas"
              valor={data.contas}
              detalhe={`${data.novasNoMes} nova${data.novasNoMes === 1 ? '' : 's'} neste mês`}
              icone={<Users className="size-5 text-ink-subtle" aria-hidden="true" />}
            />
            <Indicador
              rotulo="Inadimplentes"
              valor={data.inadimplentes}
              detalhe="Em atraso ou suspensas"
              tom={data.inadimplentes > 0 ? 'perigo' : 'neutro'}
              icone={<AlertTriangle className="size-5 text-ink-subtle" aria-hidden="true" />}
            />
            <Indicador
              rotulo="Testes terminando"
              valor={data.testesTerminando}
              detalhe="Nos próximos 7 dias"
              tom={data.testesTerminando > 0 ? 'aviso' : 'neutro'}
              icone={<Clock className="size-5 text-ink-subtle" aria-hidden="true" />}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Indicador
              rotulo="Individuais"
              valor={data.individuais}
              icone={<User className="size-5 text-ink-subtle" aria-hidden="true" />}
            />
            <Indicador
              rotulo="Empresas"
              valor={data.empresas}
              icone={<Building2 className="size-5 text-ink-subtle" aria-hidden="true" />}
            />
            <Indicador
              rotulo="Em cortesia"
              valor={data.cortesias}
              detalhe="Cupom de 100% valendo"
              icone={<Gift className="size-5 text-ink-subtle" aria-hidden="true" />}
            />
            <Indicador
              rotulo="Eventos parados"
              valor={data.webhooksPendentes}
              detalhe={
                data.webhooksPendentes > 0
                  ? 'Podem ser pagamentos não creditados'
                  : 'Nada pendente no provedor'
              }
              tom={data.webhooksPendentes > 0 ? 'perigo' : 'neutro'}
              icone={<Webhook className="size-5 text-ink-subtle" aria-hidden="true" />}
            />
          </div>

          <SituacaoDasContas metricas={data} />
        </>
      )}
    </div>
  )
}

function SituacaoDasContas({ metricas }: { metricas: Metricas }) {
  const linhas = Object.entries(metricas.porStatus)
  const total = linhas.reduce((soma, [, valor]) => soma + valor, 0) || 1

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-ink">Contas por situação</h2>
        <Link
          to="/core/contas"
          className="text-sm font-medium text-brand-700 underline underline-offset-2 dark:text-brand-300"
        >
          Ver todas
        </Link>
      </div>

      <ul className="mt-3 flex flex-col gap-2.5">
        {linhas.map(([status, valor]) => (
          <li key={status} className="flex items-center gap-3">
            <span className="w-32 shrink-0 text-sm text-ink-muted">
              {ROTULO_STATUS[status] ?? status}
            </span>

            {/* Barra proporcional: o número sozinho não mostra a distribuição,
                que é o que responde "para onde o negócio está indo". */}
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
              <span
                className="block h-full rounded-full bg-brand-600"
                style={{ width: `${Math.round((valor / total) * 100)}%` }}
              />
            </span>

            <Link
              to={`/core/contas?status=${status}`}
              className="tabular w-10 shrink-0 text-right text-sm font-semibold text-ink hover:underline"
            >
              {valor}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}
