import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { MailCheck, Send } from 'lucide-react'
import { ApiError } from '@/shared/api/client'
import { Button } from '@/shared/ui/Button'
import { InputField } from '@/shared/ui/Field'
import { usePedirRedefinicao } from '../senha.api'
import { MolduraAuth } from './MolduraAuth'

const esquema = z.object({
  email: z.string().min(1, 'Informe seu e-mail').email('E-mail inválido'),
})

type Formulario = z.infer<typeof esquema>

/**
 * "Esqueci minha senha".
 *
 * A confirmação é deliberadamente vaga — "se existir uma conta com esse
 * e-mail". O servidor responde igual para endereço cadastrado e não
 * cadastrado, e uma tela que dissesse "não encontramos esse e-mail" desfaria
 * isso: qualquer pessoa poderia descobrir quem é cliente do MNVMA digitando
 * endereços aqui.
 */
export default function EsqueciSenhaPage() {
  const pedir = usePedirRedefinicao()
  const [enviadoPara, setEnviadoPara] = useState<string | null>(null)
  const [erroGeral, setErroGeral] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: { email: '' },
  })

  async function enviar(dados: Formulario) {
    setErroGeral(null)
    try {
      await pedir.mutateAsync(dados.email)
      setEnviadoPara(dados.email)
    } catch (erro) {
      setErroGeral(
        erro instanceof ApiError
          ? erro.message
          : 'Não conseguimos enviar agora. Verifique sua conexão.',
      )
    }
  }

  if (enviadoPara) {
    return (
      <MolduraAuth titulo="Confira seu e-mail">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
            <MailCheck className="size-7" aria-hidden="true" />
          </span>

          <p className="text-ink-muted">
            Se existir uma conta com{' '}
            <strong className="font-semibold text-ink">{enviadoPara}</strong>, o link para criar uma
            senha nova acabou de sair. Ele vale por uma hora e só funciona uma vez.
          </p>

          <p className="text-sm text-ink-subtle">
            Não chegou em alguns minutos? Veja a caixa de spam antes de pedir de novo — cada pedido
            invalida o link anterior.
          </p>

          <Link
            to="/entrar"
            className="font-semibold text-brand-700 underline underline-offset-2 dark:text-brand-300"
          >
            Voltar para entrar
          </Link>
        </div>
      </MolduraAuth>
    )
  }

  return (
    <MolduraAuth
      titulo="Esqueceu a senha?"
      subtitulo="Informe seu e-mail e mandamos um link para criar outra."
    >
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

        <Button
          type="submit"
          tamanho="lg"
          larguraTotal
          carregando={isSubmitting}
          iconeEsquerda={<Send className="size-5" aria-hidden="true" />}
        >
          Enviar link
        </Button>
      </form>

      <p className="mt-6 text-center text-ink-muted">
        Lembrou?{' '}
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
