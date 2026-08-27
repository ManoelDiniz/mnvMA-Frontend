import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/features/auth/auth.store'
import { NOMES_SEMANA } from '@/features/shifts/calendario'
import { ApiError, api } from '@/shared/api/client'
import { cn } from '@/shared/lib/cn'
import { formatarData } from '@/shared/lib/format'
import { Button } from '@/shared/ui/Button'
import { Card, CardBody, CardHeader } from '@/shared/ui/Card'
import { InputField } from '@/shared/ui/Field'
import { Carregando, EstadoErro, SemPermissao } from '@/shared/ui/feedback'
import { useCuidador } from './cuidadores.api'

interface Faixa {
  id?: string
  weekday: number
  startTime: string
  endTime: string
}

interface Bloqueio {
  id: string
  blockedFrom: string
  blockedTo: string
  reason?: string | null
}

interface Disponibilidade {
  slots: Array<Faixa & { id: string }>
  blocks: Bloqueio[]
}

export default function DisponibilidadePage() {
  const { id = '' } = useParams<{ id: string }>()
  const cache = useQueryClient()
  const [erro, setErro] = useState<string | null>(null)

  const pode = useAuth((e) => e.pode)
  const somenteLeitura = useAuth((e) => e.somenteLeitura)
  const podeEditar = pode('availability:write') && !somenteLeitura()

  const { data: cuidador } = useCuidador(id)
  const chave = ['disponibilidade', id] as const

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: chave,
    queryFn: ({ signal }) =>
      api.get<Disponibilidade>(`/caregivers/${id}/availability`, { signal }),
    enabled: Boolean(id),
  })

  const [faixas, setFaixas] = useState<Faixa[]>([])
  useEffect(() => {
    if (data) setFaixas(data.slots)
  }, [data])

  const salvarGrade = useMutation({
    mutationFn: (slots: Faixa[]) =>
      api.put<Disponibilidade>(`/caregivers/${id}/availability`, {
        slots: slots.map((f) => ({
          weekday: f.weekday,
          startTime: f.startTime,
          endTime: f.endTime,
        })),
      }),
    onSuccess: (novo) => cache.setQueryData(chave, novo),
  })

  const adicionarBloqueio = useMutation({
    mutationFn: (dados: { blockedFrom: string; blockedTo: string; reason?: string }) =>
      api.post<Disponibilidade>(`/caregivers/${id}/blocks`, dados),
    onSuccess: (novo) => cache.setQueryData(chave, novo),
  })

  const removerBloqueio = useMutation({
    mutationFn: (blockId: string) =>
      api.delete<Disponibilidade>(`/caregivers/${id}/blocks/${blockId}`),
    onSuccess: (novo) => cache.setQueryData(chave, novo),
  })

  if (!pode('availability:read')) return <SemPermissao />
  if (isLoading) return <Carregando texto="Carregando disponibilidade…" />
  if (isError) return <EstadoErro erro={error} aoTentarNovamente={() => void refetch()} />

  async function salvar() {
    setErro(null)
    try {
      await salvarGrade.mutateAsync(faixas)
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não conseguimos salvar.')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-2">
        <Link
          to={`/cuidadores/${id}`}
          className="touch-target -ml-2 grid place-items-center rounded-lg text-ink-muted hover:bg-surface-muted"
          aria-label="Voltar para o cuidador"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Disponibilidade</h1>
          {cuidador && <p className="text-ink-muted">{cuidador.name}</p>}
        </div>
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
        <CardHeader
          titulo="Rotina semanal"
          descricao="Os horários em que costuma trabalhar. Serve para orientar quem monta a escala — não impede de escalar fora."
        />
        <CardBody className="flex flex-col gap-3 pt-2">
          {faixas.length === 0 && (
            <p className="text-ink-muted">
              Nenhuma rotina declarada. Sem ela, este cuidador aparece como disponível
              em qualquer horário.
            </p>
          )}

          {faixas.map((faixa, indice) => (
            <div
              key={faixa.id ?? `nova-${indice}`}
              className="flex flex-wrap items-end gap-2 rounded-xl border border-border p-3"
            >
              <label className="flex flex-1 flex-col gap-1.5" style={{ minWidth: '9rem' }}>
                <span className="text-sm font-medium text-ink">Dia</span>
                <select
                  value={faixa.weekday}
                  disabled={!podeEditar}
                  onChange={(e) =>
                    setFaixas((atual) =>
                      atual.map((f, i) =>
                        i === indice ? { ...f, weekday: Number(e.target.value) } : f,
                      ),
                    )
                  }
                  className="min-h-12 rounded-xl border border-border-strong bg-surface px-3 text-base text-ink"
                >
                  {NOMES_SEMANA.map((nome, dia) => (
                    <option key={dia} value={dia}>
                      {nome}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">Das</span>
                <input
                  type="time"
                  value={faixa.startTime}
                  disabled={!podeEditar}
                  onChange={(e) =>
                    setFaixas((atual) =>
                      atual.map((f, i) => (i === indice ? { ...f, startTime: e.target.value } : f)),
                    )
                  }
                  className="min-h-12 rounded-xl border border-border-strong bg-surface px-3 text-base text-ink"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">Até</span>
                <input
                  type="time"
                  value={faixa.endTime}
                  disabled={!podeEditar}
                  onChange={(e) =>
                    setFaixas((atual) =>
                      atual.map((f, i) => (i === indice ? { ...f, endTime: e.target.value } : f)),
                    )
                  }
                  className="min-h-12 rounded-xl border border-border-strong bg-surface px-3 text-base text-ink"
                />
              </label>

              {podeEditar && (
                <button
                  type="button"
                  onClick={() => setFaixas((atual) => atual.filter((_, i) => i !== indice))}
                  className="touch-target grid place-items-center rounded-lg text-danger hover:bg-danger-soft"
                  aria-label={`Remover faixa de ${NOMES_SEMANA[faixa.weekday]}`}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              )}

              {/* Fim menor que o início é plantão noturno, não erro — o aviso
                  evita que a pessoa ache que digitou errado. */}
              {faixa.endTime <= faixa.startTime && (
                <p className="w-full text-sm text-ink-muted">Vira o dia (plantão noturno)</p>
              )}
            </div>
          ))}

          {podeEditar && (
            <div className="flex flex-wrap gap-2">
              <Button
                variante="secondary"
                onClick={() =>
                  setFaixas((atual) => [
                    ...atual,
                    { weekday: 1, startTime: '07:00', endTime: '19:00' },
                  ])
                }
                iconeEsquerda={<Plus className="size-4" aria-hidden="true" />}
              >
                Adicionar faixa
              </Button>
              <Button onClick={() => void salvar()} carregando={salvarGrade.isPending}>
                Salvar rotina
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          titulo="Períodos indisponíveis"
          descricao="Férias, viagem, atestado. Aqui o sistema bloqueia de verdade: não deixa escalar."
        />
        <CardBody className="flex flex-col gap-3 pt-2">
          {(data?.blocks.length ?? 0) === 0 && (
            <p className="text-ink-muted">Nenhum período bloqueado.</p>
          )}

          {data?.blocks.map((bloqueio) => (
            <div
              key={bloqueio.id}
              className="flex items-center gap-3 rounded-xl border border-warning/40 bg-warning-soft p-3"
            >
              <div className="flex-1">
                <p className="tabular font-medium text-warning">
                  {formatarData(bloqueio.blockedFrom)} até {formatarData(bloqueio.blockedTo)}
                </p>
                {bloqueio.reason && <p className="text-sm text-warning">{bloqueio.reason}</p>}
              </div>
              {podeEditar && (
                <button
                  type="button"
                  onClick={() => void removerBloqueio.mutateAsync(bloqueio.id)}
                  className="touch-target grid place-items-center rounded-lg text-warning hover:bg-warning/20"
                  aria-label="Remover bloqueio"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              )}
            </div>
          ))}

          {podeEditar && <FormBloqueio aoCriar={(d) => void adicionarBloqueio.mutateAsync(d)} />}
        </CardBody>
      </Card>
    </div>
  )
}

function FormBloqueio({
  aoCriar,
}: {
  aoCriar: (dados: { blockedFrom: string; blockedTo: string; reason?: string }) => void
}) {
  const [aberto, setAberto] = useState(false)
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [motivo, setMotivo] = useState('')

  if (!aberto) {
    return (
      <Button
        variante="secondary"
        onClick={() => setAberto(true)}
        iconeEsquerda={<Plus className="size-4" aria-hidden="true" />}
        className="self-start"
      >
        Marcar indisponibilidade
      </Button>
    )
  }

  const valido = de && ate && ate >= de

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <InputField label="De" type="date" value={de} onChange={(e) => setDe(e.target.value)} />
        <InputField label="Até" type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
      </div>
      <InputField
        label="Motivo"
        placeholder="Viagem, férias, atestado…"
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
      />
      <div className="flex gap-2">
        <Button variante="secondary" onClick={() => setAberto(false)} className="flex-1">
          Cancelar
        </Button>
        <Button
          disabled={!valido}
          className={cn('flex-[2]')}
          onClick={() => {
            // O período cobre os dois dias inteiros: quem escreve "de 21 a 25"
            // quer dizer o dia 25 completo, não até a meia-noite do dia 25.
            aoCriar({
              blockedFrom: `${de}T00:00:00-03:00`,
              blockedTo: `${ate}T23:59:59-03:00`,
              reason: motivo || undefined,
            })
            setAberto(false)
            setDe('')
            setAte('')
            setMotivo('')
          }}
        >
          Bloquear período
        </Button>
      </div>
    </div>
  )
}
