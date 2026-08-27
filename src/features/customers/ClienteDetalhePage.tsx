import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Mail, Pencil, Phone, Trash2 } from 'lucide-react'
import { useAuth } from '@/features/auth/auth.store'
import { formatarCpf, formatarData, formatarTelefone, iniciais } from '@/shared/lib/format'
import { Badge, Card, CardBody, CardHeader } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { estilosBotao } from '@/shared/ui/button.styles'
import { Carregando, EstadoErro } from '@/shared/ui/feedback'
import { useCliente, useRemoverCliente } from './clientes.api'

export default function ClienteDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const navegar = useNavigate()
  const { data: cliente, isLoading, isError, refetch } = useCliente(id)
  const remover = useRemoverCliente()

  const pode = useAuth((e) => e.pode)
  const somenteLeitura = useAuth((e) => e.somenteLeitura)
  const podeEditar = pode('customers:write') && !somenteLeitura()
  const podeExcluir = pode('customers:delete') && !somenteLeitura()

  if (isLoading) return <Carregando texto="Carregando cliente…" />
  if (isError || !cliente) {
    return (
      <EstadoErro
        titulo="Cliente não encontrado"
        descricao="Ele pode ter sido removido, ou o endereço está errado."
        aoTentarNovamente={() => void refetch()}
      />
    )
  }

  async function excluir() {
    // `confirm` nativo por ora: um modal próprio entra junto com o resto do
    // sistema de diálogos, não vale improvisar um só para esta tela.
    if (!window.confirm(`Remover ${cliente!.name} da sua lista de clientes?`)) return
    await remover.mutateAsync(cliente!.id)
    void navegar('/clientes', { replace: true })
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-2">
        <Link
          to="/clientes"
          className="touch-target -ml-2 grid place-items-center rounded-lg text-ink-muted hover:bg-surface-muted"
          aria-label="Voltar para a lista de clientes"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Link>
        <h1 className="flex-1 truncate text-2xl font-bold tracking-tight text-ink">
          {cliente.name}
        </h1>
        {podeEditar && (
          <Link
            to={`/clientes/${cliente.id}/editar`}
            className={estilosBotao({ variante: 'secondary', tamanho: 'sm', className: 'gap-2' })}
          >
            <Pencil className="size-4" aria-hidden="true" />
            Editar
          </Link>
        )}
      </header>

      <Card>
        <CardBody className="flex items-start gap-4">
          <span
            className="grid size-14 shrink-0 place-items-center rounded-full bg-brand-50 text-lg font-bold text-brand-800 dark:bg-brand-900 dark:text-brand-100"
            aria-hidden="true"
          >
            {iniciais(cliente.name)}
          </span>
          <dl className="grid flex-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <Dado rotulo="CPF" valor={formatarCpf(cliente.cpf)} monoespacado />
            <Dado rotulo="Nascimento" valor={formatarData(cliente.birthDate)} />
            <Dado
              rotulo="Telefone"
              valor={formatarTelefone(cliente.phone)}
              icone={<Phone className="size-4" aria-hidden="true" />}
              href={cliente.phone ? `tel:${cliente.phone}` : undefined}
              monoespacado
            />
            <Dado
              rotulo="E-mail"
              valor={cliente.email ?? '—'}
              icone={<Mail className="size-4" aria-hidden="true" />}
              href={cliente.email ? `mailto:${cliente.email}` : undefined}
            />
          </dl>
        </CardBody>
      </Card>

      {cliente.notes && (
        <Card>
          <CardHeader titulo="Observações de cuidado" />
          <CardBody className="pt-2">
            <p className="whitespace-pre-wrap text-ink">{cliente.notes}</p>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader
          titulo="Responsáveis"
          descricao={
            cliente.responsibles?.length
              ? undefined
              : 'Nenhum responsável cadastrado para este cliente.'
          }
        />
        {cliente.responsibles && cliente.responsibles.length > 0 && (
          <CardBody className="flex flex-col gap-3 pt-2">
            {cliente.responsibles.map((responsavel) => (
              <div
                key={responsavel.id}
                className="flex flex-col gap-2 rounded-xl border border-border p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-ink">{responsavel.name}</span>
                  {responsavel.relationship && (
                    <span className="text-sm text-ink-muted">· {responsavel.relationship}</span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {responsavel.isPrimary && <Badge tom="marca">Contato principal</Badge>}
                  {responsavel.isFinancial && <Badge tom="info">Financeiro</Badge>}
                  {responsavel.isEmergency && <Badge tom="aviso">Emergência</Badge>}
                </div>

                {responsavel.phone && (
                  <a
                    href={`tel:${responsavel.phone}`}
                    className="tabular flex min-h-11 items-center gap-2 text-brand-700 dark:text-brand-300"
                  >
                    <Phone className="size-4" aria-hidden="true" />
                    {formatarTelefone(responsavel.phone)}
                  </a>
                )}
              </div>
            ))}
          </CardBody>
        )}
      </Card>

      {podeExcluir && (
        <Button
          variante="ghost"
          onClick={() => void excluir()}
          carregando={remover.isPending}
          iconeEsquerda={<Trash2 className="size-4" aria-hidden="true" />}
          className="self-start text-danger hover:bg-danger-soft"
        >
          Remover cliente
        </Button>
      )}
    </div>
  )
}

function Dado({
  rotulo,
  valor,
  icone,
  href,
  monoespacado,
}: {
  rotulo: string
  valor: string
  icone?: React.ReactNode
  href?: string
  monoespacado?: boolean
}) {
  return (
    <div>
      <dt className="text-sm text-ink-muted">{rotulo}</dt>
      <dd className={monoespacado ? 'tabular text-ink' : 'text-ink'}>
        {href ? (
          <a
            href={href}
            className="inline-flex min-h-11 items-center gap-2 text-brand-700 dark:text-brand-300"
          >
            {icone}
            {valor}
          </a>
        ) : (
          <span className="inline-flex items-center gap-2">
            {icone}
            {valor}
          </span>
        )}
      </dd>
    </div>
  )
}
