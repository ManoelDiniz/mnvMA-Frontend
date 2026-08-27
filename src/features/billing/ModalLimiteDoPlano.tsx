import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, X } from 'lucide-react'
import { useAuth } from '@/features/auth/auth.store'
import { Button } from '@/shared/ui/Button'
import { estilosBotao } from '@/shared/ui/button.styles'
import { rotuloDoRecurso, useLimiteDoPlano } from './limite.store'

/**
 * O que aparece quando o plano acaba.
 *
 * A diferença entre isto e um toast de erro é o que a pessoa faz em seguida: um
 * toast diz "não deu"; esta caixa diz o que bateu no limite, quanto o plano
 * permite e para onde ir. O 402 do backend existe justamente para separar
 * "você não tem permissão" (403, fim da linha) de "seu plano acabou" (402,
 * existe saída).
 */
export function ModalLimiteDoPlano() {
  const limite = useLimiteDoPlano((e) => e.atual)
  const fechar = useLimiteDoPlano((e) => e.fechar)
  const pode = useAuth((e) => e.pode)
  const fecharRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!limite) return

    fecharRef.current?.focus()
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') fechar()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [limite, fechar])

  if (!limite) return null

  const recurso = rotuloDoRecurso(limite.recurso)

  return (
    <div
      className="fixed inset-0 z-modal flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-limite-plano"
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) fechar()
      }}
    >
      <div className="w-full max-w-md rounded-card border border-border bg-surface p-5 shadow-card">
        <div className="flex items-start justify-between gap-3">
          <h2 id="titulo-limite-plano" className="text-lg font-semibold text-ink">
            Seu plano chegou ao limite
          </h2>
          <button
            ref={fecharRef}
            type="button"
            onClick={fechar}
            aria-label="Fechar"
            className="rounded-lg p-1 text-ink-muted hover:bg-surface-muted hover:text-ink"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <p className="mt-2 text-ink-muted">
          {limite.planoNome && limite.limite !== null
            ? `O plano ${limite.planoNome} permite ${limite.limite} ${recurso}.`
            : limite.mensagem}{' '}
          Nada do que já existe foi perdido — só não dá para criar mais um sem mudar de plano.
        </p>

        {limite.usado !== null && limite.limite !== null && (
          <p className="tabular mt-3 text-sm text-ink-subtle">
            Em uso: {limite.usado} de {limite.limite} {recurso}.
          </p>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variante="ghost" onClick={fechar}>
            Agora não
          </Button>

          {pode('billing:read') && (
            <Link
              to="/planos"
              onClick={fechar}
              className={estilosBotao({ className: 'gap-1.5' })}
            >
              Ver planos
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
