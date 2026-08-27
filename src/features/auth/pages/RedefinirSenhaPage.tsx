import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, KeyRound } from 'lucide-react'
import { ApiError } from '@/shared/api/client'
import { Button } from '@/shared/ui/Button'
import { InputField } from '@/shared/ui/Field'
import { Carregando } from '@/shared/ui/feedback'
import { usePreviaRedefinicao, useRedefinirSenha } from '../senha.api'
import { MolduraAuth } from './MolduraAuth'

const esquema = z
  .object({
    senha: z
      .string()
      .min(8, 'A senha precisa de pelo menos 8 caracteres')
      .max(72)
      .regex(/(?=.*[A-Za-zÀ-ú])(?=.*\d)/, 'A senha precisa conter letras e números'),
    confirmacao: z.string(),
  })
  .refine((d) => d.senha === d.confirmacao, {
    path: ['confirmacao'],
    message: 'As senhas não são iguais',
  })

type Formulario = z.infer<typeof esquema>

/**
 * Criar a senha nova a partir do link do e-mail.
 *
 * A prévia vem antes do formulário pelo mesmo motivo do aceite de convite: um
 * link cego pedindo credencial é exatamente o que se ensina a não clicar. Aqui
 * ela mostra o nome e o e-mail mascarado, o bastante para a pessoa se
 * reconhecer sem entregar o endereço a quem interceptou o link.
 */
export default function RedefinirSenhaPage() {
  const { token } = useParams<{ token: string }>()
  const navegar = useNavigate()

  const previa = usePreviaRedefinicao(token)
  const redefinir = useRedefinirSenha()

  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [mostrarSenha, setMostrarSenha] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: { senha: '', confirmacao: '' },
  })

  async function enviar(dados: Formulario) {
    setErroGeral(null)
    try {
      await redefinir.mutateAsync({ token: token ?? '', password: dados.senha })
    } catch (erro) {
      setErroGeral(
        erro instanceof ApiError
          ? erro.message
          : 'Não conseguimos redefinir agora. Verifique sua conexão.',
      )
      return
    }

    // Entrar sozinho seria mais rápido, mas exigiria o e-mail completo — e a
    // prévia só devolve o mascarado, de propósito. Digitar o endereço uma vez
    // também confirma, para quem estiver vendo, que a senha nova funciona.
    void navegar('/entrar', { replace: true, state: { senhaRedefinida: true } })
  }

  if (previa.isLoading) {
    return (
      <MolduraAuth titulo="Redefinir senha">
        <Carregando texto="Conferindo o link…" />
      </MolduraAuth>
    )
  }

  if (previa.isError || !previa.data) {
    return (
      <MolduraAuth titulo="Link inválido ou expirado">
        <div className="flex flex-col gap-4 text-center">
          <p className="text-ink-muted">
            Este link não vale mais. Ele dura uma hora, funciona uma única vez e deixa de valer
            assim que outro é pedido. Peça um novo e use o mais recente.
          </p>
          <Link
            to="/esqueci-senha"
            className="font-semibold text-brand-700 underline underline-offset-2 dark:text-brand-300"
          >
            Pedir outro link
          </Link>
        </div>
      </MolduraAuth>
    )
  }

  return (
    <MolduraAuth titulo="Criar uma senha nova" subtitulo={`Olá, ${previa.data.name}.`}>
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

        <div className="rounded-xl border border-border bg-surface-muted px-3.5 py-3 text-sm">
          <p className="text-ink-muted">
            Conta do e-mail{' '}
            <strong className="font-semibold text-ink">{previa.data.email}</strong>.
          </p>
          <p className="mt-1 text-ink-subtle">
            Ao salvar, as sessões abertas em outros aparelhos são encerradas.
          </p>
        </div>

        {/* O gerenciador de senhas precisa saber a qual login a credencial
            pertence — mas o e-mail aqui vem mascarado, então o campo fica de
            fora: salvar "ma***@..." seria pior que não salvar. */}

        <div className="relative">
          <InputField
            label="Nova senha"
            type={mostrarSenha ? 'text' : 'password'}
            autoComplete="new-password"
            obrigatorio
            ajuda="Pelo menos 8 caracteres, com letras e números."
            erro={errors.senha?.message}
            className="pr-12"
            {...register('senha')}
          />
          <button
            type="button"
            onClick={() => setMostrarSenha((v) => !v)}
            aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
            className="touch-target absolute top-7 right-1 grid place-items-center rounded-lg text-ink-muted hover:bg-surface-muted"
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
          tamanho="lg"
          larguraTotal
          carregando={isSubmitting}
          iconeEsquerda={<KeyRound className="size-5" aria-hidden="true" />}
        >
          Salvar nova senha
        </Button>
      </form>
    </MolduraAuth>
  )
}
