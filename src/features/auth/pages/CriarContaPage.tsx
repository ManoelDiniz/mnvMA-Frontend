import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Building2, Check, UserRound } from 'lucide-react'
import { ApiError } from '@/shared/api/client'
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/Button'
import { InputField } from '@/shared/ui/Field'
import { useAuth } from '../auth.store'
import { MolduraAuth } from './MolduraAuth'

const esquema = z
  .object({
    accountType: z.enum(['INDIVIDUAL', 'COMPANY']),
    name: z.string().trim().min(2, 'Informe seu nome completo').max(120),
    companyName: z.string().trim().max(160).optional(),
    email: z.string().min(1, 'Informe seu e-mail').email('E-mail inválido'),
    password: z
      .string()
      .min(8, 'A senha precisa de pelo menos 8 caracteres')
      .regex(/(?=.*[A-Za-zÀ-ú])(?=.*\d)/, 'A senha precisa ter letras e números'),
  })
  .refine(
    (dados) => dados.accountType !== 'COMPANY' || (dados.companyName?.length ?? 0) >= 2,
    { path: ['companyName'], message: 'Informe o nome da empresa' },
  )

type Formulario = z.infer<typeof esquema>

export default function CriarContaPage() {
  const navegar = useNavigate()
  const cadastrar = useAuth((e) => e.cadastrar)
  const [erroGeral, setErroGeral] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: { accountType: 'INDIVIDUAL', name: '', email: '', password: '' },
  })

  const tipoConta = watch('accountType')

  async function enviar(dados: Formulario) {
    setErroGeral(null)
    try {
      await cadastrar({
        name: dados.name,
        email: dados.email,
        password: dados.password,
        accountType: dados.accountType,
        companyName: dados.accountType === 'COMPANY' ? dados.companyName : undefined,
      })
      void navegar('/', { replace: true })
    } catch (erro) {
      if (erro instanceof ApiError && erro.fields) {
        // O backend devolve `fields` com o nome real do campo — cada erro vai
        // para o input certo em vez de virar um alerta genérico no topo.
        for (const [campo, mensagem] of Object.entries(erro.fields)) {
          if (campo in dados) setError(campo as keyof Formulario, { message: mensagem })
        }
        return
      }
      setErroGeral(
        erro instanceof ApiError
          ? erro.message
          : 'Não conseguimos criar a conta agora. Verifique sua conexão.',
      )
    }
  }

  return (
    <MolduraAuth
      titulo="Criar sua conta"
      subtitulo="14 dias grátis. Sem cartão de crédito."
    >
      <form onSubmit={(e) => void handleSubmit(enviar)(e)} className="flex flex-col gap-5" noValidate>
        {erroGeral && (
          <p
            role="alert"
            className="rounded-xl border border-danger/30 bg-danger-soft px-3.5 py-3 text-sm text-danger"
          >
            {erroGeral}
          </p>
        )}

        <fieldset className="flex flex-col gap-2">
          <legend className="pb-2 text-sm font-medium text-ink">Como você trabalha?</legend>

          <OpcaoConta
            selecionado={tipoConta === 'INDIVIDUAL'}
            aoSelecionar={() => setValue('accountType', 'INDIVIDUAL')}
            icone={UserRound}
            titulo="Sou cuidador(a)"
            descricao="Trabalho por conta própria e quero organizar meus clientes, plantões e ganhos."
          />

          <OpcaoConta
            selecionado={tipoConta === 'COMPANY'}
            aoSelecionar={() => setValue('accountType', 'COMPANY')}
            icone={Building2}
            titulo="Tenho uma empresa"
            descricao="Administro uma equipe de cuidadores, com escalas, contratos e rentabilidade."
          />
        </fieldset>

        <InputField
          label="Seu nome completo"
          autoComplete="name"
          autoCapitalize="words"
          obrigatorio
          erro={errors.name?.message}
          {...register('name')}
        />

        {tipoConta === 'COMPANY' && (
          <InputField
            label="Nome da empresa"
            autoComplete="organization"
            obrigatorio
            erro={errors.companyName?.message}
            {...register('companyName')}
          />
        )}

        <InputField
          label="E-mail"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          obrigatorio
          erro={errors.email?.message}
          {...register('email')}
        />

        <InputField
          label="Senha"
          type="password"
          autoComplete="new-password"
          ajuda="Pelo menos 8 caracteres, com letras e números."
          obrigatorio
          erro={errors.password?.message}
          {...register('password')}
        />

        <Button type="submit" tamanho="lg" larguraTotal carregando={isSubmitting}>
          Criar conta grátis
        </Button>

        <p className="text-center text-sm text-ink-muted">
          Você pode mudar de plano individual para empresarial depois, sem perder
          nada do que já cadastrou.
        </p>
      </form>

      <p className="mt-6 text-center text-ink-muted">
        Já tem conta?{' '}
        <Link
          to="/entrar"
          className="font-semibold text-brand-700 underline underline-offset-2 dark:text-brand-300"
        >
          Entrar
        </Link>
      </p>
    </MolduraAuth>
  )
}

function OpcaoConta({
  selecionado,
  aoSelecionar,
  icone: Icone,
  titulo,
  descricao,
}: {
  selecionado: boolean
  aoSelecionar: () => void
  icone: typeof UserRound
  titulo: string
  descricao: string
}) {
  return (
    // Cartão inteiro clicável em vez de um radio de 16px: é a primeira decisão
    // do cadastro e precisa ser fácil de acertar com o polegar.
    <button
      type="button"
      onClick={aoSelecionar}
      aria-pressed={selecionado}
      className={cn(
        'flex items-start gap-3 rounded-xl border-2 p-3.5 text-left transition-colors',
        selecionado
          ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/40'
          : 'border-border-strong bg-surface hover:bg-surface-muted',
      )}
    >
      <Icone
        className={cn(
          'mt-0.5 size-6 shrink-0',
          selecionado ? 'text-brand-700 dark:text-brand-300' : 'text-ink-subtle',
        )}
        aria-hidden="true"
      />
      <span className="flex-1">
        <span className="block font-semibold text-ink">{titulo}</span>
        <span className="mt-0.5 block text-sm text-ink-muted">{descricao}</span>
      </span>
      {/* Marca de seleção: cor sozinha não basta para quem não distingue tons */}
      {selecionado && (
        <Check className="mt-0.5 size-5 shrink-0 text-brand-700 dark:text-brand-300" aria-hidden />
      )}
    </button>
  )
}
