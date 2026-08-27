import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check, CircleAlert, Gift, Info, Lock, Tag, X } from 'lucide-react'
import { useAuth } from '@/features/auth/auth.store'
import { formatarCentavos } from '@/shared/lib/format'
import { Button } from '@/shared/ui/Button'
import { Badge, Card } from '@/shared/ui/Card'
import { EstadoErro, ListaSkeleton, SemPermissao } from '@/shared/ui/feedback'
import {
  comDesconto,
  descreverLimite,
  useAssinar,
  useAssinatura,
  usePlanos,
  usePreviaDoCupom,
  type Assinatura,
  type Plano,
  type PreviaDoCupom,
} from './assinatura.api'

/**
 * A tela de planos.
 *
 * Três decisões de produto estão desenhadas aqui:
 *
 *   1. **Plano que não cabe aparece, mas fechado, com o motivo escrito.** Uma
 *      empresa com 40 cuidadores precisa entender por que não pode descer para
 *      o plano de 10 — esconder a opção só gera a pergunta no suporte.
 *   2. **Nada some quando a conta está bloqueada.** Esta é justamente a tela
 *      que resolve o bloqueio; escondê-la de quem está suspenso seria trancar
 *      o cliente do lado de fora do próprio pagamento.
 *   3. **O cupom é conferido antes de valer.** A prévia usa a mesma validação
 *      do resgate, então o preço riscado que a pessoa vê é o preço que ela vai
 *      pagar — e um cupom de 100% avisa, com todas as letras, que não vai pedir
 *      cartão.
 */
export default function PlanosPage() {
  const pode = useAuth((e) => e.pode)
  const { data: planos, isLoading, isError, error, refetch } = usePlanos()
  const { data: assinatura } = useAssinatura()
  const assinar = useAssinar()

  const [cupom, setCupom] = useState<PreviaDoCupom | null>(null)
  const [escolhido, setEscolhido] = useState<string | null>(null)
  const [recado, setRecado] = useState<string | null>(null)

  if (!pode('billing:read')) return <SemPermissao />

  const podeAssinar = pode('billing:write')
  const lista = planos ?? []

  const escolher = (plano: Plano) => {
    setEscolhido(plano.id)
    setRecado(null)

    assinar.mutate(
      { planId: plano.id, couponCode: cupom?.code },
      {
        onSuccess: (resposta) => {
          // Destino fora do app: quem navega é o navegador, não o roteador.
          if (resposta.checkoutUrl) {
            window.location.href = resposta.checkoutUrl
            return
          }
          setRecado(resposta.message ?? 'Plano alterado.')
          setEscolhido(null)
        },
        onSettled: () => setEscolhido(null),
      },
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <Link
          to="/assinatura"
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar para a assinatura
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Planos</h1>
        <p className="text-ink-muted">
          Cobrança mensal no cartão, com cancelamento a qualquer momento. Ao cancelar, a conta
          continua funcionando até o fim do período já pago.
        </p>
      </header>

      {assinatura && !assinatura.providerReady && (
        <Aviso tom="aviso" icone={CircleAlert}>
          A cobrança ainda não está disponível neste ambiente. Os planos abaixo são o catálogo —
          nenhuma assinatura pode ser criada agora.
        </Aviso>
      )}

      {assinatura?.pendingPlan && (
        <Aviso tom="info" icone={Info}>
          A mudança para <strong>{assinatura.pendingPlan.name}</strong> já está agendada e entra na
          virada do período. Até lá vale o plano atual, que você já pagou.
        </Aviso>
      )}

      {recado && (
        <Aviso tom="sucesso" icone={Check}>
          {recado}
        </Aviso>
      )}

      {assinar.isError && (
        <Aviso tom="perigo" icone={CircleAlert}>
          {assinar.error instanceof Error
            ? assinar.error.message
            : 'Não foi possível mudar de plano agora.'}
        </Aviso>
      )}

      {podeAssinar && lista.length > 0 && (
        <CaixaDeCupom planos={lista} cupom={cupom} aoMudar={setCupom} />
      )}

      {isLoading ? (
        <ListaSkeleton linhas={3} />
      ) : isError ? (
        <EstadoErro erro={error} aoTentarNovamente={() => void refetch()} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {lista.map((plano) => (
            <li key={plano.id} className="flex">
              <CartaoDePlano
                plano={plano}
                cupom={cupom}
                podeAssinar={podeAssinar}
                enviando={assinar.isPending && escolhido === plano.id}
                bloqueadoPorOutro={assinar.isPending && escolhido !== plano.id}
                aoEscolher={() => escolher(plano)}
              />
            </li>
          ))}
        </ul>
      )}

      {assinatura && <ResumoDeUso assinatura={assinatura} />}
    </div>
  )
}

/**
 * O campo de cupom.
 *
 * A conferência acontece contra um plano pagável qualquer — o percentual vale
 * para todos, e pedir para a pessoa escolher o plano ANTES de saber se o código
 * presta seria a ordem errada das perguntas. Quem decide de verdade é o
 * servidor, na hora de assinar.
 */
function CaixaDeCupom({
  planos,
  cupom,
  aoMudar,
}: {
  planos: Plano[]
  cupom: PreviaDoCupom | null
  aoMudar: (cupom: PreviaDoCupom | null) => void
}) {
  const [codigo, setCodigo] = useState('')
  const previa = usePreviaDoCupom()

  const referencia = planos.find((p) => p.priceCents > 0 && p.available) ?? planos[0]

  const aplicar = () => {
    const limpo = codigo.trim().toUpperCase()
    if (!limpo || !referencia) return

    previa.mutate(
      { code: limpo, planId: referencia.id },
      { onSuccess: (resultado) => aoMudar(resultado) },
    )
  }

  if (cupom) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-3 border-success/40 bg-success-soft/40 p-4">
        <div className="flex items-start gap-2.5">
          {cupom.courtesy ? (
            <Gift className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
          ) : (
            <Tag className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
          )}
          <div>
            <p className="font-semibold text-ink">
              Cupom {cupom.code} aplicado — {cupom.summary}
            </p>
            <p className="text-sm text-ink-muted">
              {cupom.courtesy
                ? 'Não vamos pedir cartão: com 100% de desconto não há o que cobrar. Avisamos antes de o prazo acabar.'
                : `Economia de ${formatarCentavos(cupom.totalSavingsCents)} no total. Depois disso, o valor volta ao normal.`}
            </p>
          </div>
        </div>

        <Button
          variante="ghost"
          tamanho="sm"
          onClick={() => {
            aoMudar(null)
            setCodigo('')
            previa.reset()
          }}
          iconeEsquerda={<X className="size-4" aria-hidden="true" />}
        >
          Remover
        </Button>
      </Card>
    )
  }

  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex min-w-56 flex-1 flex-col gap-1.5">
          <label htmlFor="cupom" className="text-sm font-medium text-ink">
            Tem um cupom de desconto?
          </label>
          <input
            id="cupom"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter') aplicar()
            }}
            placeholder="BEMVINDO50"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className="min-h-12 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-base tracking-wide text-ink uppercase placeholder:text-ink-subtle placeholder:normal-case"
          />
        </div>

        <Button
          variante="secondary"
          carregando={previa.isPending}
          disabled={codigo.trim().length < 3}
          onClick={aplicar}
        >
          Aplicar
        </Button>
      </div>

      {previa.isError && (
        <p role="alert" className="text-sm text-danger">
          {previa.error instanceof Error ? previa.error.message : 'Não foi possível usar este cupom.'}
        </p>
      )}
    </Card>
  )
}

function CartaoDePlano({
  plano,
  cupom,
  podeAssinar,
  enviando,
  bloqueadoPorOutro,
  aoEscolher,
}: {
  plano: Plano
  cupom: PreviaDoCupom | null
  podeAssinar: boolean
  enviando: boolean
  bloqueadoPorOutro: boolean
  aoEscolher: () => void
}) {
  const gratuito = plano.priceCents === 0
  const indisponivel = !plano.available || !plano.checkoutAvailable
  // Cupom não se aplica a plano gratuito: não há de onde descontar.
  const comCupom = gratuito ? null : cupom
  const precoFinal = comCupom
    ? comDesconto(plano.priceCents, comCupom.discountPercent)
    : plano.priceCents

  return (
    <Card
      className={
        plano.current
          ? 'flex w-full flex-col gap-4 border-brand-600 p-5 ring-1 ring-brand-600'
          : 'flex w-full flex-col gap-4 p-5'
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-ink">{plano.name}</h2>
          {plano.description && <p className="mt-1 text-sm text-ink-muted">{plano.description}</p>}
        </div>
        {plano.current && <Badge tom="marca">Plano atual</Badge>}
      </div>

      <div>
        {comCupom && (
          <p className="text-sm text-ink-subtle line-through">{formatarCentavos(plano.priceCents)}</p>
        )}

        <p className="tabular text-3xl font-bold text-ink">
          {gratuito || precoFinal === 0 ? 'Grátis' : formatarCentavos(precoFinal)}
          {!gratuito && precoFinal > 0 && (
            <span className="text-base font-medium text-ink-muted">/mês</span>
          )}
        </p>

        {comCupom && (
          <p className="mt-1 text-sm font-medium text-success">
            {comCupom.courtesy
              ? `Por ${comCupom.maxInvoices} ${comCupom.maxInvoices === 1 ? 'mês' : 'meses'}, sem cartão`
              : `Com o cupom ${comCupom.code}, ${comCupom.maxInvoices === 1 ? 'na primeira fatura' : `nas ${comCupom.maxInvoices} primeiras faturas`}`}
          </p>
        )}
      </div>

      <ul className="flex flex-col gap-1.5 text-sm text-ink-muted">
        <ItemDeLimite>{descreverLimite('Clientes', plano.limits.maxCustomers)}</ItemDeLimite>
        <ItemDeLimite>{descreverLimite('Cuidadores', plano.limits.maxCaregivers)}</ItemDeLimite>
        <ItemDeLimite>{descreverLimite('Usuários', plano.limits.maxUsers)}</ItemDeLimite>
        <ItemDeLimite>
          {descreverLimite('Plantões por mês', plano.limits.maxShiftsPerMonth)}
        </ItemDeLimite>
      </ul>

      <div className="mt-auto flex flex-col gap-2">
        {plano.blockedReason && (
          <p className="flex items-start gap-1.5 text-sm text-warning">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{plano.blockedReason}</span>
          </p>
        )}

        {plano.current ? (
          <Button variante="secondary" larguraTotal disabled>
            Este é o seu plano
          </Button>
        ) : (
          <Button
            larguraTotal
            carregando={enviando}
            disabled={!podeAssinar || indisponivel || bloqueadoPorOutro}
            onClick={aoEscolher}
          >
            {gratuito ? 'Usar o plano gratuito' : comCupom?.courtesy ? 'Ativar sem cartão' : 'Assinar'}
          </Button>
        )}

        {!podeAssinar && (
          <p className="text-xs text-ink-subtle">
            Só quem é titular da conta pode contratar ou trocar de plano.
          </p>
        )}
      </div>
    </Card>
  )
}

function ItemDeLimite({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
      <span>{children}</span>
    </li>
  )
}

/**
 * O uso de hoje, ao lado dos planos.
 *
 * Sem isto, "este plano não comporta o uso atual" é uma frase sem prova. Com
 * ele, a pessoa confere o número e entende sozinha.
 */
function ResumoDeUso({ assinatura }: { assinatura: Pick<Assinatura, 'usage'> }) {
  const linhas: Array<[string, number]> = [
    ['Clientes', assinatura.usage.customers],
    ['Cuidadores', assinatura.usage.caregivers],
    ['Usuários', assinatura.usage.users],
    ['Plantões neste mês', assinatura.usage.shiftsPerMonth],
  ]

  return (
    <Card className="p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-ink">Seu uso hoje</h2>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {linhas.map(([rotulo, valor]) => (
          <div key={rotulo}>
            <dt className="text-sm text-ink-muted">{rotulo}</dt>
            <dd className="tabular text-xl font-semibold text-ink">{valor}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

function Aviso({
  tom,
  icone: Icone,
  children,
}: {
  tom: 'aviso' | 'info' | 'perigo' | 'sucesso'
  icone: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  children: React.ReactNode
}) {
  const cores = {
    aviso: 'border-warning/30 bg-warning-soft text-warning',
    info: 'border-info/30 bg-info-soft text-info',
    perigo: 'border-danger/30 bg-danger-soft text-danger',
    sucesso: 'border-success/30 bg-success-soft text-success',
  }[tom]

  return (
    <div role="status" className={`flex items-start gap-2 rounded-card border p-3.5 ${cores}`}>
      <Icone className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p className="text-sm">{children}</p>
    </div>
  )
}
