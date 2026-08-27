import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, History, Lock, Unlock } from 'lucide-react'
import { formatarCentavos, formatarData, formatarDinheiro } from '@/shared/lib/format'
import { Badge, Card, CardBody, CardHeader } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { TextareaField } from '@/shared/ui/Field'
import { EstadoErro, ListaSkeleton } from '@/shared/ui/feedback'
import type { StatusConta } from '@/shared/api/types'
import {
  useConta,
  useReativarConta,
  useSuspenderConta,
  type ContaDetalhe,
} from './core.api'

const ROTULO_STATUS: Record<StatusConta, string> = {
  TRIAL: 'Em teste',
  ACTIVE: 'Ativa',
  PAST_DUE: 'Em atraso',
  SUSPENDED: 'Suspensa',
  EXPIRED: 'Teste vencido',
  CANCELED: 'Cancelada',
}

/**
 * A ficha de um cliente.
 *
 * Serve para responder ao telefone: o que essa conta paga, em que pé está a
 * assinatura, quantas pessoas usam, o que já foi cobrado e — a parte que
 * normalmente falta em painel de admin — **o que nós já fizemos com ela**.
 */
export default function ContaDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading, isError, error, refetch } = useConta(id)

  return (
    <div className="flex flex-col gap-5">
      <Link
        to="/core/contas"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Voltar para as contas
      </Link>

      {isLoading ? (
        <ListaSkeleton linhas={4} />
      ) : isError || !data ? (
        <EstadoErro erro={error} aoTentarNovamente={() => void refetch()} />
      ) : (
        <>
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-ink">{data.name}</h1>
              <p className="mt-0.5 text-ink-muted">
                {data.type === 'COMPANY' ? 'Empresa' : 'Individual'}
                {data.document ? ` · ${data.document}` : ''} · cliente desde{' '}
                {formatarData(data.createdAt)}
              </p>
            </div>
            <Badge tom={data.status === 'SUSPENDED' ? 'perigo' : 'neutro'}>
              {ROTULO_STATUS[data.status]}
            </Badge>
          </header>

          <Assinatura conta={data} />
          <Uso conta={data} />
          <Pessoas conta={data} />
          {data.cobrancas.length > 0 && <Cobrancas conta={data} />}
          {data.cupons.length > 0 && <Cupons conta={data} />}
          <Acoes conta={data} />
          <Historico conta={data} />
        </>
      )}
    </div>
  )
}

function Assinatura({ conta }: { conta: ContaDetalhe }) {
  return (
    <Card>
      <CardHeader titulo="Assinatura" descricao={conta.planName ?? 'Sem plano definido'} />
      <CardBody>
        <dl className="grid gap-4 sm:grid-cols-4">
          <Dado
            rotulo="Por mês"
            valor={conta.monthlyCents > 0 ? formatarCentavos(conta.monthlyCents) : '—'}
            detalhe={conta.couponCode ? `com o cupom ${conta.couponCode}` : undefined}
          />
          <Dado
            rotulo="Situação"
            valor={conta.subscriptionStatus ?? '—'}
            detalhe={conta.pastDueSince ? `em atraso desde ${formatarData(conta.pastDueSince)}` : undefined}
          />
          <Dado
            rotulo="Acesso até"
            valor={conta.currentPeriodEnd ? formatarData(conta.currentPeriodEnd) : '—'}
          />
          <Dado
            rotulo="Próxima cobrança"
            valor={conta.nextChargeAt ? formatarData(conta.nextChargeAt) : '—'}
            detalhe={conta.canceledAt ? `cancelada em ${formatarData(conta.canceledAt)}` : undefined}
          />
        </dl>
      </CardBody>
    </Card>
  )
}

function Uso({ conta }: { conta: ContaDetalhe }) {
  const linhas: Array<[string, number]> = [
    ['Clientes', conta.usage.customers],
    ['Cuidadores', conta.usage.caregivers],
    ['Usuários', conta.usage.users],
    ['Plantões no mês', conta.usage.shiftsPerMonth],
  ]

  return (
    <Card className="p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-ink">Uso</h2>
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

function Pessoas({ conta }: { conta: ContaDetalhe }) {
  return (
    <Card>
      <CardHeader titulo="Pessoas" descricao={`${conta.usuarios.length} com acesso`} />
      <CardBody className="flex flex-col gap-2">
        {conta.usuarios.map((usuario) => (
          <div key={usuario.id} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium text-ink">{usuario.name}</span>
            <span className="text-ink-muted">{usuario.email}</span>
            <Badge tom="neutro">{usuario.roleLabel}</Badge>
            {!usuario.isActive && <Badge tom="perigo">Inativo</Badge>}
            <span className="ml-auto text-xs text-ink-subtle">
              {usuario.lastLoginAt ? `entrou em ${formatarData(usuario.lastLoginAt)}` : 'nunca entrou'}
            </span>
          </div>
        ))}
      </CardBody>
    </Card>
  )
}

function Cobrancas({ conta }: { conta: ContaDetalhe }) {
  return (
    <Card>
      <CardHeader titulo="Cobranças" descricao="As últimas da assinatura" />
      <CardBody className="flex flex-col gap-2">
        {conta.cobrancas.map((cobranca) => (
          <div key={cobranca.id} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-ink-muted">
              {formatarData(cobranca.paidAt ?? cobranca.createdAt)}
            </span>
            <span className="tabular font-medium text-ink">{formatarDinheiro(cobranca.amount)}</span>
            <Badge tom={cobranca.status === 'APPROVED' ? 'sucesso' : 'perigo'}>
              {cobranca.status}
            </Badge>
            {cobranca.statusDetail && (
              <span className="text-xs text-ink-subtle">{cobranca.statusDetail}</span>
            )}
          </div>
        ))}
      </CardBody>
    </Card>
  )
}

function Cupons({ conta }: { conta: ContaDetalhe }) {
  return (
    <Card>
      <CardHeader titulo="Cupons" descricao="O que esta conta já resgatou" />
      <CardBody className="flex flex-col gap-2">
        {conta.cupons.map((cupom) => (
          <div key={cupom.code} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium text-ink">{cupom.code}</span>
            <span className="text-ink-muted">
              {cupom.discountPercent}% ·{' '}
              {cupom.discountPercent >= 100
                ? `cortesia${cupom.endsAt ? ` até ${formatarData(cupom.endsAt)}` : ''}`
                : `${cupom.invoicesUsed} de ${cupom.maxInvoices} faturas`}
            </span>
            <Badge tom={cupom.status === 'ACTIVE' ? 'sucesso' : 'neutro'}>{cupom.status}</Badge>
          </div>
        ))}
      </CardBody>
    </Card>
  )
}

/**
 * Suspender e reativar.
 *
 * O motivo é campo obrigatório na tela porque é obrigatório no servidor — e é
 * obrigatório no servidor porque a ação sem motivo é a que ninguém consegue
 * explicar quando o cliente liga perguntando por que a conta parou.
 */
function Acoes({ conta }: { conta: ContaDetalhe }) {
  const [motivo, setMotivo] = useState('')
  const suspender = useSuspenderConta(conta.id)
  const reativar = useReativarConta(conta.id)

  const suspensa = conta.status === 'SUSPENDED'
  const emAndamento = suspender.isPending || reativar.isPending
  const erro = suspender.error ?? reativar.error

  const executar = () => {
    const texto = motivo.trim()
    if (texto.length < 5) return

    const acao = suspensa ? reativar : suspender
    acao.mutate(texto, { onSuccess: () => setMotivo('') })
  }

  return (
    <Card className="flex flex-col gap-3 p-4 sm:p-5">
      <div>
        <h2 className="font-semibold text-ink">{suspensa ? 'Reativar conta' : 'Suspender conta'}</h2>
        <p className="text-sm text-ink-muted">
          {suspensa
            ? 'A conta volta ao estado que ela realmente tem: ativa se houver período pago, em teste se ainda houver prazo, ou aguardando assinatura.'
            : 'Bloqueia a escrita e preserva a leitura. O cliente continua consultando e exportando o histórico dele.'}
        </p>
      </div>

      <TextareaField
        label="Motivo"
        obrigatorio
        ajuda="Fica no histórico da conta, com seu e-mail e a data."
        rows={2}
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
      />

      {erro && (
        <p role="alert" className="text-sm text-danger">
          {erro instanceof Error ? erro.message : 'Não foi possível concluir a ação.'}
        </p>
      )}

      <div>
        <Button
          variante={suspensa ? 'primary' : 'danger'}
          carregando={emAndamento}
          disabled={motivo.trim().length < 5}
          onClick={executar}
          iconeEsquerda={
            suspensa ? (
              <Unlock className="size-4" aria-hidden="true" />
            ) : (
              <Lock className="size-4" aria-hidden="true" />
            )
          }
        >
          {suspensa ? 'Reativar' : 'Suspender'}
        </Button>
      </div>
    </Card>
  )
}

function Historico({ conta }: { conta: ContaDetalhe }) {
  return (
    <Card>
      <CardHeader
        titulo="Histórico administrativo"
        descricao="O que o MNVMA já fez nesta conta"
        acao={<History className="size-5 text-ink-subtle" aria-hidden="true" />}
      />
      <CardBody>
        {conta.historico.length === 0 ? (
          <p className="text-sm text-ink-muted">Nada foi feito nesta conta até agora.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {conta.historico.map((acao) => (
              <li key={acao.id} className="border-l-2 border-border pl-3">
                <p className="text-sm font-medium text-ink">{acao.actionLabel}</p>
                {acao.reason && <p className="text-sm text-ink-muted">{acao.reason}</p>}
                <p className="text-xs text-ink-subtle">
                  {formatarData(acao.createdAt)}
                  {acao.actorEmail ? ` · ${acao.actorEmail}` : ''}
                </p>
              </li>
            ))}
          </ol>
        )}
      </CardBody>
    </Card>
  )
}

function Dado({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div>
      <dt className="text-sm text-ink-muted">{rotulo}</dt>
      <dd className="mt-0.5 font-semibold text-ink">{valor}</dd>
      {detalhe && <p className="text-xs text-ink-subtle">{detalhe}</p>}
    </div>
  )
}
