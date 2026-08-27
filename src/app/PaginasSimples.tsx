import { Link } from 'react-router-dom'
import { Construction, Home } from 'lucide-react'
import { estilosBotao } from '@/shared/ui/button.styles'
import { Card, CardBody } from '@/shared/ui/Card'

/**
 * Splash do boot.
 *
 * Aparece pelos milissegundos em que o app tenta recuperar a sessão pelo cookie
 * de refresh. Sem spinner girando: numa recuperação rápida ele apareceria e
 * sumiria, o que passa sensação de travamento em vez de velocidade.
 */
export function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center bg-surface-muted px-4">
      <div className="flex flex-col items-center gap-3">
        <img
          src="/icons/icon-192.png"
          alt=""
          width={56}
          height={56}
          className="size-14 rounded-2xl shadow-card"
        />
        <p className="text-ink-muted">Carregando MNVMA Care…</p>
      </div>
    </div>
  )
}

/**
 * Rota que já está no menu mas ainda não foi construída.
 *
 * É honesto dizer isso em vez de esconder o item: o menu reflete o que o
 * produto vai ser, e o usuário fica sabendo que aquilo está a caminho.
 */
export function EmBreve({ titulo, sprint }: { titulo: string; sprint: string }) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight text-ink">{titulo}</h1>
      <Card>
        <CardBody className="flex flex-col items-center gap-3 py-12 text-center">
          <Construction className="size-10 text-ink-subtle" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-semibold text-ink">Estamos construindo esta parte</h2>
            <p className="mt-1 text-ink-muted">
              {titulo} entra na próxima etapa do desenvolvimento ({sprint}).
            </p>
          </div>
          <Link to="/" className={estilosBotao({ variante: 'secondary', className: 'mt-2 gap-2' })}>
            <Home className="size-4" aria-hidden="true" />
            Voltar ao início
          </Link>
        </CardBody>
      </Card>
    </div>
  )
}

export function NaoEncontrado() {
  return (
    <div className="grid min-h-dvh place-items-center bg-surface-muted px-4">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <p className="text-4xl font-bold text-ink-subtle">404</p>
        <h1 className="text-xl font-bold text-ink">Página não encontrada</h1>
        <p className="text-ink-muted">
          O endereço que você abriu não existe ou foi movido.
        </p>
        <Link to="/" className={estilosBotao({ className: 'mt-2 gap-2' })}>
          <Home className="size-4" aria-hidden="true" />
          Ir para o início
        </Link>
      </div>
    </div>
  )
}
