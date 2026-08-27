import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle2, Eye, EyeOff, LogIn } from 'lucide-react'
import { ApiError } from '@/shared/api/client'
import { Button } from '@/shared/ui/Button'
import { InputField } from '@/shared/ui/Field'
import { useAuth } from '../auth.store'
import { MolduraAuth } from './MolduraAuth'

const esquema = z.object({
  email: z.string().min(1, 'Informe seu e-mail').email('E-mail inválido'),
  senha: z.string().min(1, 'Informe sua senha'),
})

type Formulario = z.infer<typeof esquema>

export default function EntrarPage() {
  const navegar = useNavigate()
  // Quem acabou de redefinir a senha chega aqui com este aviso. Sem ele, a
  // tela de login depois do formulário de senha parece que algo deu errado.
  const { state } = useLocation() as { state?: { senhaRedefinida?: boolean } }
  const entrar = useAuth((e) => e.entrar)
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [mostrarSenha, setMostrarSenha] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: { email: '', senha: '' },
  })

  async function enviar(dados: Formulario) {
    setErroGeral(null)
    try {
      await entrar(dados.email, dados.senha)
      void navegar('/', { replace: true })
    } catch (erro) {
      setErroGeral(
        erro instanceof ApiError
          ? erro.message
          : 'Não conseguimos entrar agora. Verifique sua conexão.',
      )
    }
  }

  return (
    <MolduraAuth
      titulo="Entrar no MNVMA Care"
      subtitulo="Sua agenda, seus clientes e seu dinheiro em um só lugar."
    >
      <form onSubmit={(e) => void handleSubmit(enviar)(e)} className="flex flex-col gap-4" noValidate>
        {state?.senhaRedefinida && !erroGeral && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-xl border border-success/30 bg-success-soft px-3.5 py-3 text-sm text-success"
          >
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Senha alterada. Entre com a nova.
          </p>
        )}

        {erroGeral && (
          <p
            role="alert"
            className="rounded-xl border border-danger/30 bg-danger-soft px-3.5 py-3 text-sm text-danger"
          >
            {erroGeral}
          </p>
        )}

        <InputField
          label="E-mail"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="voce@exemplo.com"
          obrigatorio
          erro={errors.email?.message}
          {...register('email')}
        />

        <div className="relative">
          <InputField
            label="Senha"
            type={mostrarSenha ? 'text' : 'password'}
            autoComplete="current-password"
            obrigatorio
            erro={errors.senha?.message}
            className="pr-12"
            {...register('senha')}
          />
          <button
            type="button"
            onClick={() => setMostrarSenha((v) => !v)}
            className="touch-target absolute top-7 right-1 grid place-items-center rounded-lg text-ink-muted hover:bg-surface-muted"
            aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
          >
            {mostrarSenha ? (
              <EyeOff className="size-5" aria-hidden="true" />
            ) : (
              <Eye className="size-5" aria-hidden="true" />
            )}
          </button>
        </div>

        <div className="-mt-1 text-right">
          <Link
            to="/esqueci-senha"
            className="text-sm font-medium text-brand-700 underline underline-offset-2 dark:text-brand-300"
          >
            Esqueci minha senha
          </Link>
        </div>

        <Button
          type="submit"
          tamanho="lg"
          larguraTotal
          carregando={isSubmitting}
          iconeEsquerda={<LogIn className="size-5" aria-hidden="true" />}
        >
          Entrar
        </Button>
      </form>

      <p className="mt-6 text-center text-ink-muted">
        Ainda não tem conta?{' '}
        <Link
          to="/criar-conta"
          className="font-semibold text-brand-700 underline underline-offset-2 dark:text-brand-300"
        >
          Criar conta grátis
        </Link>
      </p>
    </MolduraAuth>
  )
}
