import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import { useAuth } from '@/features/auth/auth.store'
import { MolduraAuth } from '@/features/auth/pages/MolduraAuth'
import { ApiError } from '@/shared/api/client'
import { formatarData } from '@/shared/lib/format'
import { Button } from '@/shared/ui/Button'
import { InputField } from '@/shared/ui/Field'
import { Carregando } from '@/shared/ui/feedback'
import { usePreviaConvite } from './equipe.api'

const esquema = z
  .object({
    name: z.string().trim().min(2, 'Informe seu nome').max(160),
    senha: z.string().min(8, 'A senha precisa de pelo menos 8 caracteres').max(128),
    confirmacao: z.string(),
  })
  .refine((d) => d.senha === d.confirmacao, {
    path: ['confirmacao'],
    message: 'As senhas não são iguais',
  })

type Formulario = z.infer<typeof esquema>

/**
 * Aceite do convite — a única tela do app que uma pessoa de fora abre.
 *
 * Ela chega por um link que alguém mandou, e a primeira coisa que o app pede é
 * uma senha. Por isso a prévia vem antes do formulário: em que empresa ela está
 * entrando, com que e-mail e como o quê. Sem isso, é um link cego pedindo
 * credencial — exatamente o que se ensina a não clicar.
 */
export default function AceitarConvitePage() {
  const { token } = useParams<{ token: string }>()
  const navegar = useNavigate()

  const aceitarConvite = useAuth((e) => e.aceitarConvite)
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [mostrarSenha, setMostrarSenha] = useState(false)

  const previa = usePreviaConvite(token)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: { name: '', senha: '', confirmacao: '' },
  })

  // O nome vem sugerido pelo convite, mas continua editável: quem convidou
  // escreveu "Paula" de memória, e é a própria pessoa que sabe como se chama.
  useEffect(() => {
    if (previa.data) reset({ name: previa.data.name, senha: '', confirmacao: '' })
  }, [previa.data, reset])

  async function enviar(dados: Formulario) {
    setErroGeral(null)
    try {
      await aceitarConvite({ token: token ?? '', password: dados.senha, name: dados.name })
      void navegar('/', { replace: true })
    } catch (erro) {
      setErroGeral(
        erro instanceof ApiError
          ? erro.message
          : 'Não conseguimos concluir agora. Verifique sua conexão.',
      )
    }
  }

  if (previa.isLoading) {
    return (
      <MolduraAuth titulo="Convite">
        <Carregando texto="Conferindo o convite…" />
      </MolduraAuth>
    )
  }

  if (previa.isError || !previa.data) {
    return (
      <MolduraAuth titulo="Convite inválido ou expirado">
        <div className="flex flex-col gap-4 text-center">
          <p className="text-ink-muted">
            Este link não vale mais. Convites duram poucos dias e deixam de funcionar quando são
            reenviados ou cancelados. Peça um novo a quem administra a conta.
          </p>
          <Link to="/entrar" className="text-brand-700 underline dark:text-brand-300">
            Já tenho acesso — entrar
          </Link>
        </div>
      </MolduraAuth>
    )
  }

  const convite = previa.data

  return (
    <MolduraAuth
      titulo={`Entrar na ${convite.tenantName}`}
      subtitulo={`Você foi convidado como ${convite.roleLabel.toLowerCase()}.`}
    >
      <form onSubmit={(e) => void handleSubmit(enviar)(e)} className="flex flex-col gap-4" noValidate>
        {erroGeral && (
          <p
            role="alert"
            className="rounded-xl border border-danger/30 bg-danger-soft px-3.5 py-3 text-sm text-danger"
          >
            {erroGeral}
          </p>
        )}

        <div className="rounded-xl border border-border bg-surface-muted px-3.5 py-3 text-sm">
          <p className="text-ink-muted">
            Seu acesso será o e-mail <strong className="font-semibold text-ink">{convite.email}</strong>.
          </p>
          <p className="mt-1 text-ink-subtle">
            O convite vale até {formatarData(convite.expiresAt)}.
          </p>
        </div>

        <InputField
          label="Seu nome"
          obrigatorio
          autoComplete="name"
          erro={errors.name?.message}
          {...register('name')}
        />

        {/* Campo escondido com o e-mail: sem ele o gerenciador de senhas do
            navegador salva a credencial sem saber a qual login ela pertence. */}
        <input type="hidden" autoComplete="username" value={convite.email} readOnly />

        <div className="relative">
          <InputField
            label="Crie uma senha"
            type={mostrarSenha ? 'text' : 'password'}
            autoComplete="new-password"
            obrigatorio
            ajuda="Pelo menos 8 caracteres. Ninguém da empresa vê a sua senha."
            erro={errors.senha?.message}
            className="pr-12"
            {...register('senha')}
          />
          <button
            type="button"
            onClick={() => setMostrarSenha((v) => !v)}
            aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
            className="absolute right-1 top-7 rounded-lg p-2.5 text-ink-subtle hover:text-ink"
          >
            {mostrarSenha ? (
              <EyeOff className="size-5" aria-hidden="true" />
            ) : (
              <Eye className="size-5" aria-hidden="true" />
            )}
          </button>
        </div>

        <InputField
          label="Repita a senha"
          type={mostrarSenha ? 'text' : 'password'}
          autoComplete="new-password"
          obrigatorio
          erro={errors.confirmacao?.message}
          {...register('confirmacao')}
        />

        <Button
          type="submit"
          larguraTotal
          carregando={isSubmitting}
          iconeEsquerda={<LogIn className="size-5" aria-hidden="true" />}
          className="gap-2"
        >
          Criar acesso e entrar
        </Button>
      </form>
    </MolduraAuth>
  )
}
