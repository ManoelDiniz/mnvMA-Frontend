import { useState } from 'react'
import { AlertTriangle, ArrowRightLeft, Check, History, UserPlus } from 'lucide-react'
import { cn } from '@/shared/lib/cn'
import { formatarData, formatarDinheiro, formatarHora } from '@/shared/lib/format'
import { Button } from '@/shared/ui/Button'
import { Badge, Card, CardBody, CardHeader } from '@/shared/ui/Card'
import { InputField } from '@/shared/ui/Field'
import {
  useCandidatos,
  useSubstituicoes,
  useSubstituirCuidador,
  type Candidato,
  type Plantao,
  type Substituicao,
} from './plantoes.api'

/**
 * Trocar o cuidador de um plantão — e deixar rastro.
 *
 * Existe separado de "editar o plantão" de propósito. Editar troca o campo e
 * apaga o passado; aqui a troca vira linha no histórico, com motivo e autor. É
 * essa diferença que permite responder, três meses depois, "por que esse
 * cliente reclama de rotatividade?" e "quantas vezes fulana largou plantão?".
 *
 * Duas decisões que a tela carrega:
 *
 *   • **Quem não pode cobrir aparece assim mesmo, com o motivo.** Sumir da
 *     lista sem explicação é pior: quem monta a escala fica sem saber se a
 *     pessoa tem outro plantão, se declarou indisponibilidade ou se foi
 *     desativada da equipe.
 *   • **Escalar à força é possível, e fica marcado.** Plantão em duas horas,
 *     ninguém livre, alguém aceita cobrir mesmo bloqueado — isso acontece de
 *     verdade. O que não pode é acontecer sem ninguém saber, então o aviso é
 *     explícito e a marca vai junto do motivo, para sempre.
 */
export function SubstituirCuidador({
  plantao,
  podeTrocar,
}: {
  plantao: Plantao
  podeTrocar: boolean
}) {
  const [aberto, setAberto] = useState(false)
  const { data: historico } = useSubstituicoes(plantao.id)

  // Plantão concluído não troca de cuidador: os lançamentos financeiros já
  // saíram no nome de quem trabalhou. O backend recusa; a tela nem oferece.
  const encerrado = plantao.status === 'COMPLETED' || plantao.status === 'CANCELED'
  const descoberto = !plantao.caregiverId

  return (
    <div className="flex flex-col gap-3">
      {podeTrocar && !encerrado && (
        <Card>
          <CardHeader
            titulo={descoberto ? 'Escalar cuidador' : 'Trocar cuidador'}
            descricao={
              descoberto
                ? 'O plantão está descoberto. Quem assumir fica registrado como cobertura.'
                : 'A troca fica no histórico, com o motivo e quem fez.'
            }
            acao={
              !aberto && (
                <Button
                  variante="secondary"
                  tamanho="sm"
                  onClick={() => setAberto(true)}
                  iconeEsquerda={
                    descoberto ? (
                      <UserPlus className="size-4" aria-hidden="true" />
                    ) : (
                      <ArrowRightLeft className="size-4" aria-hidden="true" />
                    )
                  }
                >
                  {descoberto ? 'Escalar' : 'Trocar'}
                </Button>
              )
            }
          />

          {aberto && (
            <Formulario
              plantao={plantao}
              descoberto={descoberto}
              aoFechar={() => setAberto(false)}
            />
          )}
        </Card>
      )}

      {historico && historico.length > 0 && <Historico trocas={historico} />}
    </div>
  )
}

function Formulario({
  plantao,
  descoberto,
  aoFechar,
}: {
  plantao: Plantao
  descoberto: boolean
  aoFechar: () => void
}) {
  const { data: candidatos, isLoading } = useCandidatos(plantao.id)
  const substituir = useSubstituirCuidador(plantao.id)

  const [escolhido, setEscolhido] = useState<Candidato | null>(null)
  const [motivo, setMotivo] = useState('')
  const [custo, setCusto] = useState('')
  const [forcar, setForcar] = useState(false)

  const precisaForcar = escolhido !== null && !escolhido.available
  const podeEnviar =
    escolhido !== null && motivo.trim().length >= 3 && (!precisaForcar || forcar)

  const enviar = () => {
    if (!escolhido) return

    substituir.mutate(
      {
        caregiverId: escolhido.id,
        reason: motivo.trim(),
        ...(custo.trim() ? { caregiverCost: custo.trim() } : {}),
        ...(precisaForcar ? { force: true } : {}),
      },
      { onSuccess: aoFechar },
    )
  }

  const disponiveis = (candidatos ?? []).filter((c) => c.available)
  const bloqueados = (candidatos ?? []).filter((c) => !c.available)

  return (
    <CardBody className="flex flex-col gap-4 pt-2">
      {isLoading ? (
        <p className="text-sm text-ink-muted">Vendo quem pode cobrir…</p>
      ) : (candidatos ?? []).length === 0 ? (
        <p className="text-sm text-ink-muted">
          Nenhum cuidador cadastrado na equipe além do atual.
        </p>
      ) : (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-ink">Quem vai assumir</legend>

          {disponiveis.map((candidato) => (
            <OpcaoDeCuidador
              key={candidato.id}
              candidato={candidato}
              escolhido={escolhido?.id === candidato.id}
              aoEscolher={() => {
                setEscolhido(candidato)
                setForcar(false)
              }}
            />
          ))}

          {bloqueados.length > 0 && (
            <>
              <p className="mt-2 text-xs font-medium tracking-wide text-ink-subtle uppercase">
                Não deveriam cobrir agora
              </p>
              {bloqueados.map((candidato) => (
                <OpcaoDeCuidador
                  key={candidato.id}
                  candidato={candidato}
                  escolhido={escolhido?.id === candidato.id}
                  aoEscolher={() => {
                    setEscolhido(candidato)
                    setForcar(false)
                  }}
                />
              ))}
            </>
          )}
        </fieldset>
      )}

      <InputField
        label="Motivo"
        obrigatorio
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder={
          descoberto ? 'Cobertura de plantão sem cuidador' : 'Cuidadora com atestado médico'
        }
        ajuda="Fica no histórico do plantão, do cliente e dos dois cuidadores."
      />

      <InputField
        label="Custo do novo cuidador"
        value={custo}
        onChange={(e) => setCusto(e.target.value)}
        placeholder={plantao.caregiverCost}
        ajuda={`Vazio mantém ${formatarDinheiro(plantao.caregiverCost)}, que é o custo atual do plantão. Preencha só se quem assumiu cobra diferente — é isso que mantém a margem certa.`}
      />

      {precisaForcar && escolhido && (
        <label className="flex items-start gap-2 rounded-card border border-warning/30 bg-warning-soft p-3 text-sm text-warning">
          <input
            type="checkbox"
            checked={forcar}
            onChange={(e) => setForcar(e.target.checked)}
            className="mt-1 size-4 shrink-0"
          />
          <span>
            <strong>{escolhido.name}</strong> {escolhido.reason?.toLowerCase() ?? 'está bloqueado'}.
            Escalar mesmo assim.
            <span className="mt-0.5 block text-warning/90">
              A marca "escalado à força" fica gravada no motivo, junto do que você escreveu acima.
            </span>
          </span>
        </label>
      )}

      {substituir.isError && (
        <p role="alert" className="text-sm text-danger">
          {substituir.error instanceof Error
            ? substituir.error.message
            : 'Não foi possível trocar o cuidador.'}
        </p>
      )}

      <div className="flex gap-2">
        <Button variante="secondary" onClick={aoFechar} className="flex-1">
          Voltar
        </Button>
        <Button
          onClick={enviar}
          disabled={!podeEnviar}
          carregando={substituir.isPending}
          className="flex-[2]"
          iconeEsquerda={<Check className="size-4" aria-hidden="true" />}
        >
          {descoberto ? 'Escalar' : 'Confirmar troca'}
        </Button>
      </div>
    </CardBody>
  )
}

function OpcaoDeCuidador({
  candidato,
  escolhido,
  aoEscolher,
}: {
  candidato: Candidato
  escolhido: boolean
  aoEscolher: () => void
}) {
  return (
    <button
      type="button"
      onClick={aoEscolher}
      aria-pressed={escolhido}
      className={cn(
        'flex min-h-14 items-center gap-3 rounded-card border p-3 text-left transition-colors',
        escolhido
          ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600 dark:bg-brand-900/40'
          : 'border-border bg-surface hover:bg-surface-muted',
        !candidato.available && !escolhido && 'opacity-75',
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-ink">{candidato.name}</span>
        <span className="block truncate text-sm text-ink-muted">
          {candidato.available ? (
            candidato.shiftsSameDay > 0 ? (
              `Livre · já tem ${candidato.shiftsSameDay} plantão${candidato.shiftsSameDay === 1 ? '' : 'ões'} neste dia`
            ) : (
              'Livre neste horário'
            )
          ) : (
            <span className="inline-flex items-center gap-1 text-warning">
              <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
              {candidato.reason ?? 'Indisponível'}
            </span>
          )}
        </span>
      </span>

      {candidato.shiftRate && (
        <span className="tabular shrink-0 text-sm text-ink-muted">
          {formatarDinheiro(candidato.shiftRate)}
        </span>
      )}
    </button>
  )
}

function Historico({ trocas }: { trocas: Substituicao[] }) {
  return (
    <Card>
      <CardHeader
        titulo="Trocas deste plantão"
        descricao={`${trocas.length} registro${trocas.length === 1 ? '' : 's'}`}
        acao={<History className="size-5 text-ink-subtle" aria-hidden="true" />}
      />
      <CardBody>
        <ol className="flex flex-col gap-3">
          {trocas.map((troca) => (
            <li key={troca.id} className="border-l-2 border-border pl-3">
              <p className="flex flex-wrap items-center gap-1.5 text-sm text-ink">
                {troca.wasUncovered ? (
                  <>
                    <Badge tom="info">Cobertura</Badge>
                    <strong>{troca.newCaregiverName}</strong> assumiu um plantão que estava sem
                    cuidador
                  </>
                ) : (
                  <>
                    <span className="text-ink-muted">{troca.previousCaregiverName ?? '—'}</span>
                    <ArrowRightLeft className="size-3.5 text-ink-subtle" aria-hidden="true" />
                    <strong>{troca.newCaregiverName}</strong>
                  </>
                )}
              </p>
              <p className="text-sm text-ink-muted">{troca.reason}</p>
              <p className="text-xs text-ink-subtle">
                {formatarData(troca.createdAt)} às {formatarHora(troca.createdAt)}
                {troca.changedByName ? ` · ${troca.changedByName}` : ''}
              </p>
            </li>
          ))}
        </ol>
      </CardBody>
    </Card>
  )
}
