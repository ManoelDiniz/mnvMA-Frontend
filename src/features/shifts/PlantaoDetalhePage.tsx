import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarClock, Pencil, Trash2, User, UserRound } from 'lucide-react'
import { useAuth } from '@/features/auth/auth.store'
import { ApiError } from '@/shared/api/client'
import { cn } from '@/shared/lib/cn'
import { formatarData, formatarDinheiro, formatarHora } from '@/shared/lib/format'
import { Button } from '@/shared/ui/Button'
import { estilosBotao } from '@/shared/ui/button.styles'
import { Badge, Card, CardBody, CardHeader } from '@/shared/ui/Card'
import { InputField } from '@/shared/ui/Field'
import { Carregando, EstadoErro } from '@/shared/ui/feedback'
import {
  EXIGEM_MOTIVO,
  PROXIMOS_STATUS,
  STATUS_PLANTAO,
  useMudarStatus,
  usePlantao,
  useRemoverPlantao,
  type StatusPlantao,
} from './plantoes.api'

export default function PlantaoDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const navegar = useNavigate()
  const [erro, setErro] = useState<string | null>(null)
  const [pedindoMotivo, setPedindoMotivo] = useState<StatusPlantao | null>(null)
  const [motivo, setMotivo] = useState('')

  const pode = useAuth((e) => e.pode)
  const somenteLeitura = useAuth((e) => e.somenteLeitura)
  const empresa = useAuth((e) => e.conta?.type === 'COMPANY')

  const { data: plantao, isLoading, isError, refetch } = usePlantao(id)
  const mudarStatus = useMudarStatus(id ?? '')
  const remover = useRemoverPlantao()

  if (isLoading) return <Carregando texto="Carregando plantão…" />
  if (isError || !plantao) {
    return (
      <EstadoErro
        titulo="Plantão não encontrado"
        descricao="Ele pode ter sido removido, ou o endereço está errado."
        aoTentarNovamente={() => void refetch()}
      />
    )
  }

  const status = STATUS_PLANTAO[plantao.status]
  const proximos = PROXIMOS_STATUS[plantao.status]
  const podeEditar = pode('shifts:write') && !somenteLeitura() && plantao.status !== 'COMPLETED'
  const podeMudarStatus = pode('shifts:write') && !somenteLeitura() && proximos.length > 0

  async function aplicar(novo: StatusPlantao, comMotivo?: string) {
    setErro(null)
    try {
      await mudarStatus.mutateAsync({ status: novo, reason: comMotivo })
      setPedindoMotivo(null)
      setMotivo('')
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não conseguimos mudar o status.')
    }
  }

  function pedir(novo: StatusPlantao) {
    // Cancelar e marcar falta pedem motivo — é o que vira histórico do cliente
    // e do cuidador, e sem isso o relatório de ocorrências fica sem serventia.
    if (EXIGEM_MOTIVO.includes(novo)) {
      setPedindoMotivo(novo)
      setMotivo('')
      return
    }
    void aplicar(novo)
  }

  async function excluir() {
    if (!window.confirm('Excluir este plantão da agenda?')) return
    try {
      await remover.mutateAsync(plantao!.id)
      void navegar('/agenda', { replace: true })
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não conseguimos excluir.')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-2">
        <Link
          to="/agenda"
          className="touch-target -ml-2 grid place-items-center rounded-lg text-ink-muted hover:bg-surface-muted"
          aria-label="Voltar para a agenda"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Link>
        <h1 className="flex-1 text-2xl font-bold tracking-tight text-ink">Plantão</h1>
        {podeEditar && (
          <Link
            to={`/plantoes/${plantao.id}/editar`}
            className={estilosBotao({ variante: 'secondary', tamanho: 'sm', className: 'gap-2' })}
          >
            <Pencil className="size-4" aria-hidden="true" />
            Editar
          </Link>
        )}
      </header>

      {erro && (
        <p
          role="alert"
          className="rounded-xl border border-danger/30 bg-danger-soft px-3.5 py-3 text-sm text-danger"
        >
          {erro}
        </p>
      )}

      <Card>
        <CardBody className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tom={status.tom}>{status.rotulo}</Badge>
            {plantao.statusReason && (
              <span className="text-sm text-ink-muted">{plantao.statusReason}</span>
            )}
          </div>

          <div className="flex items-start gap-3">
            <CalendarClock className="mt-0.5 size-5 shrink-0 text-ink-subtle" aria-hidden="true" />
            <div>
              <p className="tabular text-lg font-semibold text-ink">
                {formatarHora(plantao.startsAt)} – {formatarHora(plantao.endsAt)}
              </p>
              <p className="text-ink-muted">
                {formatarData(plantao.startsAt)} · {plantao.hours}h
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <User className="size-5 shrink-0 text-ink-subtle" aria-hidden="true" />
            <Link
              to={`/clientes/${plantao.customerId}`}
              className="font-medium text-brand-700 underline underline-offset-2 dark:text-brand-300"
            >
              {plantao.customerName}
            </Link>
          </div>

          {empresa && (
            <div className="flex items-center gap-3">
              <UserRound className="size-5 shrink-0 text-ink-subtle" aria-hidden="true" />
              {plantao.caregiverName ? (
                <span className="text-ink">{plantao.caregiverName}</span>
              ) : (
                // Plantão descoberto é problema operacional: precisa saltar aos
                // olhos, não ficar escondido como "campo vazio".
                <span className="font-medium text-warning">
                  Sem cuidador definido — precisa de cobertura
                </span>
              )}
            </div>
          )}

          {plantao.serviceName && (
            <p className="text-ink-muted">Serviço: {plantao.serviceName}</p>
          )}

          {plantao.notes && (
            <p className="rounded-xl bg-surface-muted p-3 whitespace-pre-wrap text-ink">
              {plantao.notes}
            </p>
          )}
        </CardBody>
      </Card>

      {/* Rentabilidade só faz sentido quando existe custo com terceiro. Numa
          conta individual o valor cobrado é o que a pessoa ganha, e mostrar
          "margem 100%" só confundiria. */}
      <Card>
        <CardHeader titulo={empresa ? 'Resultado deste plantão' : 'Valor'} />
        <CardBody className="flex flex-wrap gap-x-8 gap-y-3 pt-2">
          <Valor rotulo="Cobrado do cliente" valor={plantao.chargeAmount} />
          {empresa && (
            <>
              <Valor rotulo="Pago ao cuidador" valor={plantao.caregiverCost} />
              <Valor rotulo="Outros custos" valor={plantao.otherCosts} />
              <Valor
                rotulo="Sobra"
                valor={plantao.margin}
                destaque={Number(plantao.margin) >= 0 ? 'sucesso' : 'perigo'}
              />
            </>
          )}
        </CardBody>
      </Card>

      {podeMudarStatus && (
        <Card>
          <CardHeader
            titulo="Atualizar situação"
            descricao="Depois de concluído, o plantão não volta atrás."
          />
          <CardBody className="flex flex-wrap gap-2 pt-2">
            {proximos.map((novo) => (
              <Button
                key={novo}
                variante={novo === 'COMPLETED' ? 'primary' : 'secondary'}
                onClick={() => pedir(novo)}
                carregando={mudarStatus.isPending && pedindoMotivo === null}
              >
                {STATUS_PLANTAO[novo].rotulo}
              </Button>
            ))}
          </CardBody>
        </Card>
      )}

      {pedindoMotivo && (
        <Card>
          <CardBody className="flex flex-col gap-3">
            <InputField
              label={`Motivo — ${STATUS_PLANTAO[pedindoMotivo].rotulo.toLowerCase()}`}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              obrigatorio
              autoFocus
              placeholder="Cliente foi internado, cuidador adoeceu…"
              ajuda="Fica registrado no histórico do cliente e do cuidador."
            />
            <div className="flex gap-2">
              <Button
                variante="secondary"
                onClick={() => setPedindoMotivo(null)}
                className="flex-1"
              >
                Voltar
              </Button>
              <Button
                onClick={() => void aplicar(pedindoMotivo, motivo)}
                disabled={motivo.trim().length === 0}
                carregando={mudarStatus.isPending}
                className="flex-[2]"
              >
                Confirmar
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {pode('shifts:delete') && !somenteLeitura() && plantao.status !== 'COMPLETED' && (
        <Button
          variante="ghost"
          onClick={() => void excluir()}
          carregando={remover.isPending}
          iconeEsquerda={<Trash2 className="size-4" aria-hidden="true" />}
          className="self-start text-danger hover:bg-danger-soft"
        >
          Excluir plantão
        </Button>
      )}
    </div>
  )
}

function Valor({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string
  valor: string
  destaque?: 'sucesso' | 'perigo'
}) {
  return (
    <div>
      <p className="text-sm text-ink-muted">{rotulo}</p>
      <p
        className={cn(
          'tabular text-lg font-semibold',
          destaque === 'sucesso' ? 'text-success' : destaque === 'perigo' ? 'text-danger' : 'text-ink',
        )}
      >
        {formatarDinheiro(valor)}
      </p>
    </div>
  )
}
