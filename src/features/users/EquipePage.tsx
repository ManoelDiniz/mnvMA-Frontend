import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Check, Copy, Mail, Plus, RotateCw, Trash2, UserPlus, X } from 'lucide-react'
import { useAuth } from '@/features/auth/auth.store'
import { useCaregivers } from '@/features/caregivers/cuidadores.api'
import { ApiError } from '@/shared/api/client'
import { formatarData, iniciais, tempoRelativo } from '@/shared/lib/format'
import { Button } from '@/shared/ui/Button'
import { Badge, Card, CardBody, CardHeader } from '@/shared/ui/Card'
import { InputField } from '@/shared/ui/Field'
import { Selecao } from '@/shared/ui/Selecao'
import { EstadoErro, EstadoVazio, ListaSkeleton, SemPermissao } from '@/shared/ui/feedback'
import {
  PAPEIS_CONCEDIVEIS,
  RESUMO_PAPEL,
  ROTULO_PAPEL,
  useAtualizarUsuario,
  useCancelarConvite,
  useConvidar,
  useConvites,
  useRemoverUsuario,
  useReenviarConvite,
  useUsuarios,
  type Convite,
  type ConviteCriado,
  type PapelConcedivel,
  type UsuarioEquipe,
} from './equipe.api'

const esquema = z
  .object({
    name: z.string().trim().min(2, 'Informe o nome de quem você está convidando').max(160),
    email: z.string().trim().min(1, 'Informe o e-mail').email('E-mail inválido'),
    role: z.enum(PAPEIS_CONCEDIVEIS, { message: 'Escolha o que essa pessoa vai poder fazer' }),
    caregiverId: z.string().optional(),
  })
  .refine((d) => d.role !== 'CAREGIVER' || Boolean(d.caregiverId), {
    path: ['caregiverId'],
    message: 'Escolha qual cuidador este acesso representa',
  })

type Formulario = z.infer<typeof esquema>

export default function EquipePage() {
  const pode = useAuth((e) => e.pode)
  const somenteLeitura = useAuth((e) => e.somenteLeitura)

  const [formAberto, setFormAberto] = useState(false)
  const [linkGerado, setLinkGerado] = useState<ConviteCriado | null>(null)

  const usuarios = useUsuarios({ status: 'all' })
  const convites = useConvites('pending')

  if (!pode('users:read')) return <SemPermissao />

  const podeEscrever = pode('users:write') && !somenteLeitura()
  const lista = usuarios.data?.data ?? []
  const pendentes = convites.data?.data ?? []

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Equipe</h1>
          <p className="mt-0.5 text-ink-muted">
            Quem tem acesso à conta e o que cada um enxerga.
          </p>
        </div>

        {podeEscrever && !formAberto && (
          <Button
            onClick={() => {
              setFormAberto(true)
              setLinkGerado(null)
            }}
            iconeEsquerda={<Plus className="size-5" aria-hidden="true" />}
            className="gap-2"
          >
            Convidar
          </Button>
        )}
      </header>

      {linkGerado && (
        <LinkDoConvite convite={linkGerado} aoFechar={() => setLinkGerado(null)} />
      )}

      {formAberto && (
        <FormularioConvite
          aoCriar={(criado) => {
            setLinkGerado(criado)
            setFormAberto(false)
          }}
          aoCancelar={() => setFormAberto(false)}
        />
      )}

      {pendentes.length > 0 && (
        <Card>
          <CardHeader
            titulo="Convites em aberto"
            descricao="Quem já foi convidado mas ainda não criou a senha."
          />
          <CardBody className="pt-3">
            <ul className="flex flex-col divide-y divide-border">
              {pendentes.map((convite) => (
                <LinhaConvite
                  key={convite.id}
                  convite={convite}
                  podeEscrever={podeEscrever}
                  aoReenviar={setLinkGerado}
                />
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-ink">Acessos</h2>

        {usuarios.isLoading ? (
          <ListaSkeleton linhas={3} />
        ) : usuarios.isError ? (
          <EstadoErro aoTentarNovamente={() => void usuarios.refetch()} />
        ) : lista.length === 0 ? (
          <EstadoVazio
            titulo="Ninguém mais tem acesso"
            descricao="Convide quem coordena a escala ou cuida do financeiro — cada um enxerga só o que precisa."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {lista.map((usuario) => (
              <LinhaUsuario key={usuario.id} usuario={usuario} podeEscrever={podeEscrever} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

// ─── Link recém-criado ────────────────────────────────────────────────────────

/**
 * O link aparece uma vez só e não volta: o servidor guarda apenas o hash do
 * token.
 *
 * O convite sai por e-mail, mas a caixa continua aqui por dois motivos: e-mail
 * de sistema cai em spam com frequência, e boa parte dos cuidadores recebe tudo
 * por WhatsApp. Quando o envio falha, o texto muda de tom — aí o link deixa de
 * ser atalho e passa a ser o único caminho.
 */
function LinkDoConvite({ convite, aoFechar }: { convite: ConviteCriado; aoFechar: () => void }) {
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(convite.inviteUrl)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    } catch {
      // Sem permissão de área de transferência (http, navegador antigo): o
      // campo continua selecionável, então a pessoa copia na mão.
      setCopiado(false)
    }
  }

  return (
    <Card className="border-brand-600/40 bg-brand-50 dark:bg-brand-900/30">
      <CardBody className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 size-5 shrink-0 text-brand-700 dark:text-brand-300" aria-hidden />
            <div>
              <h2 className="font-semibold text-ink">
                {convite.emailDelivered
                  ? `Convite enviado para ${convite.invitation.name}`
                  : `Convite de ${convite.invitation.name} pronto`}
              </h2>
              <p className="text-sm text-ink-muted">
                {convite.emailDelivered ? (
                  <>
                    O e-mail saiu para {convite.invitation.email}. Se não chegar, mande este link
                    direto —
                  </>
                ) : (
                  <>
                    <strong className="font-semibold">Não conseguimos enviar o e-mail.</strong>{' '}
                    Mande este link para {convite.invitation.email} —
                  </>
                )}{' '}
                ele vale até {formatarData(convite.invitation.expiresAt)} e{' '}
                <strong className="font-semibold">não aparece de novo</strong>. Se perder, é só
                reenviar o convite.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar aviso do convite"
            className="-m-2 rounded-lg p-2 text-ink-subtle transition-colors hover:bg-surface-muted"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            readOnly
            value={convite.inviteUrl}
            aria-label="Link do convite"
            onFocus={(e) => e.currentTarget.select()}
            className="min-h-12 w-full flex-1 rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-ink"
          />
          <Button
            onClick={() => void copiar()}
            variante={copiado ? 'secondary' : 'primary'}
            iconeEsquerda={
              copiado ? (
                <Check className="size-5" aria-hidden="true" />
              ) : (
                <Copy className="size-5" aria-hidden="true" />
              )
            }
            className="gap-2"
          >
            {copiado ? 'Copiado' : 'Copiar link'}
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

// ─── Formulário de convite ────────────────────────────────────────────────────

function FormularioConvite({
  aoCriar,
  aoCancelar,
}: {
  aoCriar: (criado: ConviteCriado) => void
  aoCancelar: () => void
}) {
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const convidar = useConvidar()

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: { name: '', email: '', role: 'COORDINATOR', caregiverId: '' },
  })

  const papel = watch('role')
  const ehCuidador = papel === 'CAREGIVER'

  // Só busca a lista de cuidadores quando ela vai ser mostrada.
  const cuidadores = useCaregivers({ status: 'active' })

  async function enviar(dados: Formulario) {
    setErroGeral(null)
    try {
      const criado = await convidar.mutateAsync({
        name: dados.name,
        email: dados.email,
        role: dados.role,
        caregiverId: ehCuidador ? dados.caregiverId : undefined,
      })
      aoCriar(criado)
    } catch (erro) {
      if (erro instanceof ApiError && erro.fields) {
        for (const [campo, mensagem] of Object.entries(erro.fields)) {
          setError(campo as keyof Formulario, { message: mensagem })
        }
        if (!Object.keys(erro.fields).length) setErroGeral(erro.message)
        return
      }
      setErroGeral(
        erro instanceof ApiError ? erro.message : 'Não conseguimos criar o convite agora.',
      )
    }
  }

  return (
    <Card>
      <CardHeader
        titulo="Convidar alguém"
        descricao="A pessoa cria a própria senha pelo link. Você não vê nem escolhe a senha dela."
      />
      <CardBody className="pt-3">
        <form
          onSubmit={(e) => void handleSubmit(enviar)(e)}
          className="flex flex-col gap-4"
          noValidate
        >
          {erroGeral && (
            <p
              role="alert"
              className="rounded-xl border border-danger/30 bg-danger-soft px-3.5 py-3 text-sm text-danger"
            >
              {erroGeral}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <InputField
              label="Nome"
              obrigatorio
              autoComplete="off"
              erro={errors.name?.message}
              {...register('name')}
            />
            <InputField
              label="E-mail"
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              obrigatorio
              erro={errors.email?.message}
              {...register('email')}
            />
          </div>

          <Selecao
            label="O que essa pessoa vai poder fazer"
            obrigatorio
            placeholder="Escolha o papel"
            ajuda={RESUMO_PAPEL[papel]}
            erro={errors.role?.message}
            opcoes={PAPEIS_CONCEDIVEIS.map((p) => ({ valor: p, rotulo: ROTULO_PAPEL[p] }))}
            {...register('role')}
          />

          {ehCuidador && (
            <Selecao
              label="Cuidador que este acesso representa"
              obrigatorio
              placeholder={cuidadores.isLoading ? 'Carregando…' : 'Escolha o cuidador'}
              ajuda="Ele vai enxergar só os próprios plantões e a própria disponibilidade."
              erro={errors.caregiverId?.message}
              opcoes={(cuidadores.data?.data ?? []).map((c) => ({
                valor: c.id,
                rotulo: c.name,
              }))}
              {...register('caregiverId')}
            />
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              carregando={isSubmitting}
              iconeEsquerda={<UserPlus className="size-5" aria-hidden="true" />}
              className="gap-2"
            >
              Gerar convite
            </Button>
            <Button variante="ghost" onClick={aoCancelar}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}

// ─── Linhas ───────────────────────────────────────────────────────────────────

function LinhaConvite({
  convite,
  podeEscrever,
  aoReenviar,
}: {
  convite: Convite
  podeEscrever: boolean
  aoReenviar: (criado: ConviteCriado) => void
}) {
  const reenviar = useReenviarConvite()
  const cancelar = useCancelarConvite()

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 first:pt-0 last:pb-0">
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-ink">{convite.name}</span>
          <Badge tom="marca">{convite.roleLabel}</Badge>
        </span>
        <span className="mt-0.5 block truncate text-sm text-ink-muted">{convite.email}</span>
        <span className="text-sm text-ink-subtle">
          enviado {tempoRelativo(convite.createdAt)} · vale até{' '}
          {formatarData(convite.expiresAt)}
        </span>
      </span>

      {podeEscrever && (
        <span className="flex gap-1.5">
          <Button
            variante="ghost"
            tamanho="sm"
            carregando={reenviar.isPending}
            onClick={() => {
              reenviar.mutate(convite.id, { onSuccess: aoReenviar })
            }}
            iconeEsquerda={<RotateCw className="size-4" aria-hidden="true" />}
            className="gap-1.5"
          >
            Reenviar
          </Button>
          <Button
            variante="ghost"
            tamanho="sm"
            carregando={cancelar.isPending}
            onClick={() => {
              if (!window.confirm(`Cancelar o convite de ${convite.name}?`)) return
              cancelar.mutate(convite.id)
            }}
            aria-label={`Cancelar convite de ${convite.name}`}
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </span>
      )}
    </li>
  )
}

function LinhaUsuario({
  usuario,
  podeEscrever,
}: {
  usuario: UsuarioEquipe
  podeEscrever: boolean
}) {
  const [erro, setErro] = useState<string | null>(null)
  const atualizar = useAtualizarUsuario()
  const remover = useRemoverUsuario()

  // O titular responde pela conta e ninguém edita a si mesmo: as duas travas
  // existem no backend, e repeti-las aqui evita oferecer um botão que só vai
  // devolver erro.
  const ehTitular = usuario.role === 'OWNER'
  const editavel = podeEscrever && !ehTitular && !usuario.isSelf

  function alterar(dados: Parameters<typeof atualizar.mutate>[0]['dados']) {
    setErro(null)
    atualizar.mutate(
      { id: usuario.id, dados },
      {
        onError: (e) =>
          setErro(e instanceof ApiError ? e.message : 'Não conseguimos salvar a alteração.'),
      },
    )
  }

  return (
    <li className="rounded-card border border-border bg-surface p-3.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
        <span
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-muted text-sm font-semibold text-ink-muted"
        >
          {iniciais(usuario.name)}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-ink">{usuario.name}</span>
            {usuario.isSelf && <Badge tom="info">Você</Badge>}
            {!usuario.isActive && <Badge tom="neutro">Sem acesso</Badge>}
          </span>
          <span className="mt-0.5 block truncate text-sm text-ink-muted">{usuario.email}</span>
          {usuario.caregiverName && (
            <span className="text-sm text-ink-subtle">
              cuidador: {usuario.caregiverName}
            </span>
          )}
          <span className="block text-sm text-ink-subtle">
            {usuario.lastLoginAt
              ? `último acesso ${tempoRelativo(usuario.lastLoginAt)}`
              : 'ainda não entrou'}
          </span>
        </span>

        {editavel ? (
          <span className="flex flex-wrap items-center gap-1.5">
            <label className="sr-only" htmlFor={`papel-${usuario.id}`}>
              Papel de {usuario.name}
            </label>
            <select
              id={`papel-${usuario.id}`}
              value={usuario.role}
              disabled={atualizar.isPending}
              onChange={(e) => alterar({ role: e.target.value as PapelConcedivel })}
              className="min-h-11 rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink disabled:opacity-60"
            >
              {PAPEIS_CONCEDIVEIS.map((p) => (
                <option key={p} value={p}>
                  {ROTULO_PAPEL[p]}
                </option>
              ))}
            </select>

            <Button
              variante="ghost"
              tamanho="sm"
              onClick={() => alterar({ isActive: !usuario.isActive })}
              carregando={atualizar.isPending}
            >
              {usuario.isActive ? 'Suspender' : 'Reativar'}
            </Button>

            <Button
              variante="ghost"
              tamanho="sm"
              carregando={remover.isPending}
              aria-label={`Remover o acesso de ${usuario.name}`}
              onClick={() => {
                if (
                  !window.confirm(
                    `Remover o acesso de ${usuario.name}? O que ela registrou continua no histórico.`,
                  )
                ) {
                  return
                }
                remover.mutate(usuario.id, {
                  onError: (e) =>
                    setErro(e instanceof ApiError ? e.message : 'Não conseguimos remover o acesso.'),
                })
              }}
            >
              <Trash2 className="size-4 text-danger" aria-hidden="true" />
            </Button>
          </span>
        ) : (
          <Badge tom={ehTitular ? 'marca' : 'neutro'}>{usuario.roleLabel}</Badge>
        )}
      </div>

      {erro && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {erro}
        </p>
      )}
    </li>
  )
}
