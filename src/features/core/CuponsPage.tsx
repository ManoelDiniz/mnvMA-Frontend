import { useState } from 'react'
import { ChevronDown, ChevronRight, Gift, Plus, Power, Tag, UserPlus } from 'lucide-react'
import { formatarData } from '@/shared/lib/format'
import { Badge, Card, CardBody, CardHeader } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { InputField, TextareaField } from '@/shared/ui/Field'
import { Selecao } from '@/shared/ui/Selecao'
import { EstadoErro, EstadoVazio, ListaSkeleton } from '@/shared/ui/feedback'
import {
  ROTULO_RESGATE,
  resumirCupom,
  useAdicionarAlvos,
  useCriarCupom,
  useCupons,
  useDesligarCupom,
  useResgatesDoCupom,
  type Cupom,
  type NovoCupom,
} from './core.api'

/**
 * Cupons, do lado de quem cria.
 *
 * A tela existe para tornar visível o que o modelo já garante e que ninguém
 * enxerga olhando o banco: se o cupom é aberto ou nominal, se ainda dá para
 * resgatar (e por que não), quantos já usaram, e o que acontece quando o
 * percentual é 100 — que não é "quase de graça", é um caminho sem cartão.
 */
export default function CuponsPage() {
  const { data, isLoading, isError, error, refetch } = useCupons()
  const [criando, setCriando] = useState(false)

  const cupons = data ?? []

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Cupons</h1>
          <p className="mt-0.5 text-ink-muted">
            Desconto percentual sobre a mensalidade, por um número definido de faturas.
          </p>
        </div>

        <Button
          onClick={() => setCriando((aberto) => !aberto)}
          iconeEsquerda={<Plus className="size-5" aria-hidden="true" />}
        >
          Novo cupom
        </Button>
      </header>

      {criando && <FormularioDeCupom aoTerminar={() => setCriando(false)} />}

      {isLoading ? (
        <ListaSkeleton linhas={3} />
      ) : isError ? (
        <EstadoErro erro={error} aoTentarNovamente={() => void refetch()} />
      ) : cupons.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum cupom criado"
          descricao="Cupom é campanha: um percentual, por algumas faturas, para todo mundo ou para pessoas específicas."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {cupons.map((cupom) => (
            <li key={cupom.id}>
              <LinhaDeCupom cupom={cupom} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FormularioDeCupom({ aoTerminar }: { aoTerminar: () => void }) {
  const criar = useCriarCupom()

  const [dados, setDados] = useState({
    code: '',
    name: '',
    description: '',
    discountPercent: '50',
    maxInvoices: '1',
    expiresAt: '',
    maxRedemptions: '',
    tenantType: '',
    emails: '',
    firstSubscriptionOnly: false,
  })

  const trocar = (campo: string, valor: string | boolean) =>
    setDados((atual) => ({ ...atual, [campo]: valor }))

  const percentual = Number(dados.discountPercent)
  const cortesia = percentual >= 100

  const enviar = () => {
    const emails = dados.emails
      .split(/[\s,;]+/)
      .map((e) => e.trim())
      .filter(Boolean)

    const corpo: NovoCupom = {
      code: dados.code.trim().toUpperCase(),
      name: dados.name.trim(),
      discountPercent: percentual,
      maxInvoices: Number(dados.maxInvoices) || 1,
      firstSubscriptionOnly: dados.firstSubscriptionOnly,
      ...(dados.description.trim() ? { description: dados.description.trim() } : {}),
      // `expiresAt` fecha a janela de RESGATE — não é a duração do desconto.
      ...(dados.expiresAt ? { expiresAt: new Date(`${dados.expiresAt}T23:59:59`).toISOString() } : {}),
      ...(dados.maxRedemptions ? { maxRedemptions: Number(dados.maxRedemptions) } : {}),
      ...(dados.tenantType ? { tenantType: dados.tenantType as 'INDIVIDUAL' | 'COMPANY' } : {}),
      ...(emails.length > 0 ? { targets: { emails } } : {}),
    }

    criar.mutate(corpo, { onSuccess: aoTerminar })
  }

  return (
    <Card>
      <CardHeader
        titulo="Novo cupom"
        descricao="Sem e-mails na lista, o cupom é aberto: qualquer conta resgata."
      />
      <CardBody className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <InputField
            label="Código"
            obrigatorio
            ajuda="É o que o cliente digita. Letras, números e hífen."
            value={dados.code}
            onChange={(e) => trocar('code', e.target.value.toUpperCase())}
            placeholder="BEMVINDO50"
            autoCapitalize="characters"
            spellCheck={false}
          />
          <InputField
            label="Nome da campanha"
            obrigatorio
            ajuda="Só para você se achar depois."
            value={dados.name}
            onChange={(e) => trocar('name', e.target.value)}
            placeholder="Campanha de lançamento"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <InputField
            label="Desconto (%)"
            obrigatorio
            type="number"
            min={1}
            max={100}
            ajuda={
              cortesia
                ? 'Cortesia: a conta é liberada sem checkout e sem cartão, pelo prazo abaixo.'
                : 'De 1 a 100. Em 100 o cupom vira cortesia.'
            }
            value={dados.discountPercent}
            onChange={(e) => trocar('discountPercent', e.target.value)}
          />
          <InputField
            label={cortesia ? 'Meses de cortesia' : 'Por quantas faturas'}
            obrigatorio
            type="number"
            min={1}
            max={120}
            value={dados.maxInvoices}
            onChange={(e) => trocar('maxInvoices', e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <InputField
            label="Resgatável até"
            type="date"
            ajuda="Fim da janela de resgate, não do desconto."
            value={dados.expiresAt}
            onChange={(e) => trocar('expiresAt', e.target.value)}
          />
          <InputField
            label="Máximo de resgates"
            type="number"
            min={1}
            ajuda="Vazio = sem teto."
            value={dados.maxRedemptions}
            onChange={(e) => trocar('maxRedemptions', e.target.value)}
          />
          <Selecao
            label="Tipo de conta"
            placeholder="Os dois"
            value={dados.tenantType}
            onChange={(e) => trocar('tenantType', e.target.value)}
            opcoes={[
              { valor: 'INDIVIDUAL', rotulo: 'Só individuais' },
              { valor: 'COMPANY', rotulo: 'Só empresas' },
            ]}
          />
        </div>

        <TextareaField
          label="E-mails com direito"
          rows={2}
          ajuda="Separe por vírgula ou linha. Deixe vazio para o cupom valer para qualquer conta."
          value={dados.emails}
          onChange={(e) => trocar('emails', e.target.value)}
          placeholder="contato@casaderepouso.com.br, maria@exemplo.com"
        />

        <label className="flex items-start gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={dados.firstSubscriptionOnly}
            onChange={(e) => trocar('firstSubscriptionOnly', e.target.checked)}
            className="mt-1 size-4"
          />
          <span>
            Só para quem nunca assinou
            <span className="block text-ink-muted">
              Sem isto, quem cancela e volta a cada três meses renova o desconto para sempre.
            </span>
          </span>
        </label>

        {criar.isError && (
          <p role="alert" className="text-sm text-danger">
            {criar.error instanceof Error ? criar.error.message : 'Não foi possível criar o cupom.'}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            carregando={criar.isPending}
            disabled={dados.code.trim().length < 3 || dados.name.trim().length < 3}
            onClick={enviar}
          >
            Criar cupom
          </Button>
          <Button variante="ghost" onClick={aoTerminar} disabled={criar.isPending}>
            Cancelar
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

function LinhaDeCupom({ cupom }: { cupom: Cupom }) {
  const [aberto, setAberto] = useState(false)
  const desligar = useDesligarCupom()

  return (
    <Card className="flex flex-col">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="flex min-h-16 items-center gap-3 p-3.5 text-left transition-colors hover:bg-surface-muted"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-muted">
          {cupom.courtesy ? (
            <Gift className="size-5 text-ink-muted" aria-hidden="true" />
          ) : (
            <Tag className="size-5 text-ink-muted" aria-hidden="true" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink">
            {cupom.code}
            <span className="ml-2 font-normal text-ink-muted">{resumirCupom(cupom)}</span>
          </p>
          <p className="truncate text-sm text-ink-muted">
            {cupom.name} · {cupom.redemptions} resgate{cupom.redemptions === 1 ? '' : 's'}
            {cupom.maxRedemptions ? ` de ${cupom.maxRedemptions}` : ''}
            {cupom.expiresAt ? ` · até ${formatarData(cupom.expiresAt)}` : ''}
          </p>
        </div>

        {cupom.restricted && <Badge tom="info">Nominal</Badge>}
        {cupom.courtesy && <Badge tom="marca">Cortesia</Badge>}
        <Badge tom={cupom.redeemable ? 'sucesso' : 'neutro'}>
          {cupom.redeemable ? 'Resgatável' : (cupom.blockedReason ?? 'Fechado')}
        </Badge>

        {aberto ? (
          <ChevronDown className="size-5 shrink-0 text-ink-subtle" aria-hidden="true" />
        ) : (
          <ChevronRight className="size-5 shrink-0 text-ink-subtle" aria-hidden="true" />
        )}
      </button>

      {aberto && (
        <div className="flex flex-col gap-4 border-t border-border p-4">
          {cupom.description && <p className="text-sm text-ink-muted">{cupom.description}</p>}

          <Alvos cupom={cupom} />
          <Resgates cupomId={cupom.id} />

          {cupom.isActive && (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variante="ghost"
                tamanho="sm"
                carregando={desligar.isPending}
                onClick={() => desligar.mutate(cupom.id)}
                iconeEsquerda={<Power className="size-4" aria-hidden="true" />}
              >
                Desligar cupom
              </Button>
              <p className="text-xs text-ink-subtle">
                Fecha para novos resgates. Quem já resgatou continua com o desconto combinado.
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

function Alvos({ cupom }: { cupom: Cupom }) {
  const [emails, setEmails] = useState('')
  const adicionar = useAdicionarAlvos()

  const enviar = () => {
    const lista = emails
      .split(/[\s,;]+/)
      .map((e) => e.trim())
      .filter(Boolean)
    if (lista.length === 0) return

    adicionar.mutate({ id: cupom.id, emails: lista }, { onSuccess: () => setEmails('') })
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-ink">
        Quem pode usar{' '}
        <span className="font-normal text-ink-muted">
          {cupom.restricted ? `(${cupom.targetEmails.length} na lista)` : '(aberto a qualquer conta)'}
        </span>
      </h3>

      {cupom.targetEmails.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {cupom.targetEmails.map((email) => (
            <li key={email}>
              <Badge tom="neutro">{email}</Badge>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-56 flex-1">
          <InputField
            label="Acrescentar e-mails"
            ajuda="Basta um e-mail na lista para o cupom deixar de ser aberto."
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            placeholder="maria@exemplo.com, joao@exemplo.com"
          />
        </div>
        <Button
          variante="secondary"
          carregando={adicionar.isPending}
          disabled={emails.trim().length < 3}
          onClick={enviar}
          iconeEsquerda={<UserPlus className="size-4" aria-hidden="true" />}
        >
          Acrescentar
        </Button>
      </div>
    </div>
  )
}

function Resgates({ cupomId }: { cupomId: string }) {
  const { data, isLoading } = useResgatesDoCupom(cupomId)

  if (isLoading) return <p className="text-sm text-ink-muted">Carregando resgates…</p>

  const resgates = data ?? []
  if (resgates.length === 0) {
    return <p className="text-sm text-ink-muted">Ninguém resgatou este cupom ainda.</p>
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-ink">Quem resgatou</h3>
      <ul className="flex flex-col gap-1.5">
        {resgates.map((resgate) => (
          <li key={resgate.id} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium text-ink">{resgate.tenantName}</span>
            <span className="text-ink-muted">
              {resgate.discountPercent >= 100
                ? `cortesia${resgate.endsAt ? ` até ${formatarData(resgate.endsAt)}` : ''}`
                : `${resgate.invoicesUsed} de ${resgate.maxInvoices} faturas`}
            </span>
            <Badge tom={resgate.status === 'ACTIVE' ? 'sucesso' : 'neutro'}>
              {ROTULO_RESGATE[resgate.status]}
            </Badge>
            <span className="ml-auto text-xs text-ink-subtle">
              {formatarData(resgate.redeemedAt)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
