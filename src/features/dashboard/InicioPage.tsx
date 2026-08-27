import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, Coins, UserPlus, Users } from 'lucide-react'
import { useAuth } from '@/features/auth/auth.store'
import { useResumoFinanceiro } from '@/features/finance/financeiro.api'
import {
  fimDoDia,
  hojeChave,
  inicioDoDia,
  primeiroDiaDoMes,
  ultimoDiaDoMes,
} from '@/features/shifts/calendario'
import { CartaoPlantao } from '@/features/shifts/AgendaPage'
import { usePlantoes } from '@/features/shifts/plantoes.api'
import { formatarDinheiro } from '@/shared/lib/format'
import { estilosBotao } from '@/shared/ui/button.styles'
import { Card, CardBody, Indicador } from '@/shared/ui/Card'
import { Skeleton } from '@/shared/ui/feedback'

/**
 * Início.
 *
 * O cuidador independente pergunta "quanto eu trabalhei e quanto eu ganhei?";
 * a empresa pergunta "quanto vendi, quanto custou e quanto sobrou?". A tela
 * responde uma ou outra conforme o tipo de conta — não as duas.
 */
export default function InicioPage() {
  const usuario = useAuth((e) => e.usuario)
  const conta = useAuth((e) => e.conta)
  const pode = useAuth((e) => e.pode)
  const empresa = conta?.type === 'COMPANY'

  const hoje = hojeChave()
  const mes = useMemo(
    () => ({ from: primeiroDiaDoMes(hoje), to: ultimoDiaDoMes(hoje) }),
    [hoje],
  )

  const podeVerFinanceiro = pode('finance:read')
  const { data: resumo, isLoading: carregandoResumo } = useResumoFinanceiro(mes.from, mes.to)

  const { data: plantoesDoMes, isLoading: carregandoMes } = usePlantoes({
    from: inicioDoDia(mes.from).toISOString(),
    to: fimDoDia(mes.to).toISOString(),
  })


  const estatisticas = useMemo(() => {
    const validos = (plantoesDoMes ?? []).filter(
      (p) => p.status !== 'CANCELED' && p.status !== 'NO_SHOW',
    )
    return {
      total: validos.length,
      horas: Math.round(validos.reduce((soma, p) => soma + p.hours, 0)),
      semCuidador: validos.filter((p) => !p.caregiverId).length,
    }
  }, [plantoesDoMes])

  /**
   * Próximo plantão, derivado do mês que JÁ foi carregado.
   *
   * Antes isto era uma segunda consulta com `from: new Date().toISOString()`.
   * O instante era recalculado a cada render e ia direto para a chave da query,
   * então cada resposta gerava uma chave nova, que disparava outra busca: um
   * laço que fazia ~190 requisições por segundo enquanto a aba ficasse aberta,
   * até estourar o limite da API e derrubar as OUTRAS telas com 429.
   *
   * Nada que muda a cada milissegundo pode entrar numa chave de cache. Aqui o
   * "agora" continua existindo — só que como filtro sobre o dado, não como
   * identidade dele.
   */
  const proximo = useMemo(() => {
    const agora = Date.now()
    return (plantoesDoMes ?? [])
      .filter((p) => p.status !== 'CANCELED' && p.status !== 'NO_SHOW')
      // `endsAt` e não `startsAt`: às 15h o plantão que começou às 7h e termina
      // às 19h ainda é o plantão de agora.
      .filter((p) => new Date(p.endsAt).getTime() >= agora)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0]
  }, [plantoesDoMes])

  const primeiroNome = usuario?.name.split(' ')[0] ?? ''
  const contaVazia = !carregandoMes && estatisticas.total === 0

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          {saudacao()}, {primeiroNome}
        </h1>
        <p className="mt-1 text-ink-muted">
          {empresa
            ? 'Resumo da operação e do resultado da sua empresa.'
            : 'Resumo dos seus plantões e do seu dinheiro.'}
        </p>
      </header>

      {contaVazia && <PrimeirosPassos empresa={empresa} />}

      <section aria-labelledby="titulo-mes">
        <h2 id="titulo-mes" className="mb-3 text-lg font-semibold text-ink">
          Este mês
        </h2>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {carregandoMes ? (
            <>
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </>
          ) : (
            <>
              <Indicador
                rotulo="Plantões"
                valor={estatisticas.total}
                detalhe={`${estatisticas.horas}h trabalhadas`}
              />

              {podeVerFinanceiro && !carregandoResumo && resumo ? (
                <>
                  <Indicador
                    rotulo="A receber"
                    valor={formatarDinheiro(resumo.toReceive)}
                    tom={Number(resumo.overdueReceivable) > 0 ? 'aviso' : 'neutro'}
                    detalhe={
                      Number(resumo.overdueReceivable) > 0
                        ? `${formatarDinheiro(resumo.overdueReceivable)} vencido`
                        : undefined
                    }
                  />
                  <Indicador
                    rotulo="Recebido"
                    valor={formatarDinheiro(resumo.received)}
                    tom="sucesso"
                  />
                  <Indicador
                    rotulo={empresa ? 'Resultado' : 'Sobrou'}
                    valor={formatarDinheiro(resumo.cashResult)}
                    tom={Number(resumo.cashResult) >= 0 ? 'sucesso' : 'perigo'}
                    detalhe="Entrou menos saiu"
                  />
                </>
              ) : (
                <>
                  <Skeleton className="h-24" />
                  <Skeleton className="h-24" />
                  <Skeleton className="h-24" />
                </>
              )}
            </>
          )}
        </div>
      </section>

      {/* Plantão descoberto é problema operacional do dia, não estatística:
          fica em destaque próprio, com o caminho para resolver. */}
      {empresa && estatisticas.semCuidador > 0 && (
        <Card className="border-warning/40 bg-warning-soft">
          <CardBody className="flex flex-wrap items-center gap-3">
            <UserPlus className="size-6 shrink-0 text-warning" aria-hidden="true" />
            <p className="flex-1 font-medium text-warning">
              {estatisticas.semCuidador === 1
                ? '1 plantão deste mês está sem cuidador definido'
                : `${estatisticas.semCuidador} plantões deste mês estão sem cuidador definido`}
            </p>
            <Link
              to="/agenda"
              className={estilosBotao({ variante: 'secondary', tamanho: 'sm', className: 'gap-2' })}
            >
              Resolver
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </CardBody>
        </Card>
      )}

      <section aria-labelledby="titulo-proximo">
        <h2 id="titulo-proximo" className="mb-3 text-lg font-semibold text-ink">
          Próximo plantão
        </h2>

        {proximo ? (
          <CartaoPlantao plantao={proximo} />
        ) : (
          <Card>
            <CardBody className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <CalendarDays
                className="size-10 shrink-0 text-brand-700 dark:text-brand-300"
                aria-hidden="true"
              />
              <p className="flex-1 text-ink-muted">
                Nenhum plantão à frente hoje.
              </p>
              <Link
                to="/agenda"
                className={estilosBotao({ variante: 'secondary', className: 'gap-2' })}
              >
                Ver agenda
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </CardBody>
          </Card>
        )}
      </section>
    </div>
  )
}

/**
 * Conta nova abre vazia, e tela vazia sem direção faz a pessoa desistir antes de
 * entender o produto. Some assim que o primeiro plantão existe.
 */
function PrimeirosPassos({ empresa }: { empresa: boolean }) {
  return (
    <Card>
      <CardBody>
        <h2 className="font-semibold text-ink">Comece por aqui</h2>
        <p className="mt-0.5 text-sm text-ink-muted">
          Três passos para o MNVMA começar a trabalhar por você.
        </p>

        <ol className="mt-4 flex flex-col gap-2">
          <Passo
            numero={1}
            icone={Users}
            titulo="Cadastre seu primeiro cliente"
            descricao="Quem você atende, com os contatos dos responsáveis."
            para="/clientes/novo"
          />
          <Passo
            numero={2}
            icone={Coins}
            titulo="Defina seus serviços"
            descricao={
              empresa
                ? 'Valor cobrado do cliente e valor pago ao cuidador.'
                : 'Plantão de 12h, diurno, noturno — e quanto você cobra.'
            }
            para="/servicos/novo"
          />
          <Passo
            numero={3}
            icone={empresa ? UserPlus : CalendarDays}
            titulo={empresa ? 'Cadastre sua equipe' : 'Agende seu primeiro plantão'}
            descricao={
              empresa
                ? 'Seus cuidadores, com valores e disponibilidade.'
                : 'Plantão concluído vira conta a receber automaticamente.'
            }
            para={empresa ? '/cuidadores/novo' : '/plantoes/novo'}
          />
        </ol>
      </CardBody>
    </Card>
  )
}

function Passo({
  numero,
  icone: Icone,
  titulo,
  descricao,
  para,
}: {
  numero: number
  icone: typeof Users
  titulo: string
  descricao: string
  para: string
}) {
  return (
    <li>
      <Link
        to={para}
        className="flex min-h-14 items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-surface-muted"
      >
        <span
          className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-bold text-brand-800 dark:bg-brand-900 dark:text-brand-100"
          aria-hidden="true"
        >
          {numero}
        </span>
        <span className="flex-1">
          <span className="flex items-center gap-2 font-medium text-ink">
            <Icone className="size-4 text-ink-subtle" aria-hidden="true" />
            {titulo}
          </span>
          <span className="mt-0.5 block text-sm text-ink-muted">{descricao}</span>
        </span>
        <ArrowRight className="size-5 shrink-0 text-brand-700 dark:text-brand-300" aria-hidden="true" />
      </Link>
    </li>
  )
}

function saudacao(): string {
  const hora = new Date().getHours()
  if (hora < 12) return 'Bom dia'
  if (hora < 18) return 'Boa tarde'
  return 'Boa noite'
}
