import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, Clock, CreditCard } from 'lucide-react'
import { api } from '@/shared/api/client'
import { useAuth } from '@/features/auth/auth.store'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { estilosBotao } from '@/shared/ui/button.styles'
import type { Assinatura } from './assinatura.api'

/** Quantas vezes perguntar antes de parar e devolver o controle à pessoa. */
const TENTATIVAS = 10
const INTERVALO_MS = 3000

/**
 * A volta do checkout do Mercado Pago.
 *
 * Esta tela **não ativa nada** — ela só pergunta. Quem ativa a conta é o
 * webhook, depois de conferir a assinatura HMAC do provedor; se a ativação
 * dependesse desta URL, qualquer pessoa a montaria no navegador e usaria o
 * produto de graça.
 *
 * O que ela resolve é o intervalo entre o pagamento e a chegada do webhook:
 * alguns segundos, às vezes mais. Em vez de deixar o cliente olhando para uma
 * conta ainda bloqueada logo depois de pagar, pergunta de novo a cada três
 * segundos e conta o que está acontecendo. Se passar do limite, oferece
 * continuar sem esperar — a confirmação chega sozinha de qualquer forma.
 */
export default function RetornoPage() {
  const navegar = useNavigate()
  const recarregarSessao = useAuth((e) => e.recarregarSessao)

  const [tentativas, setTentativas] = useState(0)
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null)
  const [desistiu, setDesistiu] = useState(false)
  const cancelado = useRef(false)

  const confirmada = assinatura?.status === 'ACTIVE'

  useEffect(() => {
    cancelado.current = false

    async function perguntar(rodada: number): Promise<void> {
      if (cancelado.current) return

      try {
        // `sync` reconsulta o provedor: se o webhook se perdeu, é aqui que a
        // conta é acertada sem ninguém precisar abrir chamado.
        const atual = await api.post<Assinatura>('/billing/sync')
        if (cancelado.current) return

        setAssinatura(atual)
        setTentativas(rodada)

        if (atual.status === 'ACTIVE') {
          await recarregarSessao()
          return
        }
      } catch {
        // Falhou a consulta: segue tentando. A confirmação real vem do webhook.
        setTentativas(rodada)
      }

      if (rodada >= TENTATIVAS) {
        setDesistiu(true)
        return
      }

      setTimeout(() => void perguntar(rodada + 1), INTERVALO_MS)
    }

    void perguntar(1)

    return () => {
      cancelado.current = true
    }
  }, [recarregarSessao])

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5 py-6">
      <Card className="flex flex-col items-center gap-4 p-6 text-center sm:p-8">
        {confirmada ? (
          <>
            <CheckCircle2 className="size-12 text-success" aria-hidden="true" />
            <div>
              <h1 className="text-2xl font-bold text-ink">Assinatura confirmada</h1>
              <p className="mt-1 text-ink-muted">
                {assinatura?.plan
                  ? `O plano ${assinatura.plan.name} já está valendo.`
                  : 'Sua conta está liberada.'}{' '}
                A cobrança se repete todo mês no mesmo cartão, e dá para cancelar quando quiser.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => void navegar('/')}>Ir para o início</Button>
              <Link to="/assinatura" className={estilosBotao({ variante: 'secondary' })}>
                Ver assinatura
              </Link>
            </div>
          </>
        ) : desistiu ? (
          <>
            <CreditCard className="size-12 text-ink-subtle" aria-hidden="true" />
            <div>
              <h1 className="text-2xl font-bold text-ink">Ainda estamos confirmando</h1>
              <p className="mt-1 text-ink-muted">
                O banco pode levar alguns minutos para confirmar o pagamento. Não é preciso pagar de
                novo nem ficar nesta tela: assim que a confirmação chegar, a conta libera sozinha.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Link to="/assinatura" className={estilosBotao()}>
                Ver assinatura
              </Link>
              <Button variante="secondary" onClick={() => void navegar('/')}>
                Continuar usando
              </Button>
            </div>
          </>
        ) : (
          <>
            <Clock className="size-12 animate-pulse text-brand-700 dark:text-brand-400" aria-hidden />
            <div>
              <h1 className="text-2xl font-bold text-ink">Confirmando seu pagamento</h1>
              <p className="mt-1 text-ink-muted">
                Estamos esperando a confirmação do Mercado Pago. Isso costuma levar poucos segundos
                — pode deixar esta tela aberta.
              </p>
            </div>
            <p className="text-sm text-ink-subtle" role="status">
              Tentativa {tentativas || 1} de {TENTATIVAS}
            </p>
          </>
        )}
      </Card>

      {!confirmada && (
        <p className="text-center text-sm text-ink-subtle">
          Se você desistiu no meio do checkout, nada foi cobrado.{' '}
          <Link to="/planos" className="font-medium underline underline-offset-2">
            Voltar aos planos
          </Link>
        </p>
      )}
    </div>
  )
}
