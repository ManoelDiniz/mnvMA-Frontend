import { forwardRef, useId, type SelectHTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

export interface SelecaoProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  erro?: string
  ajuda?: string
  obrigatorio?: boolean
  placeholder: string
  opcoes: Array<{ valor: string; rotulo: string }>
}

/**
 * Select nativo, de propósito.
 *
 * No celular ele abre a roda do sistema: maior, familiar e operável com uma mão
 * só. Um combobox customizado ficaria mais bonito e seria pior de usar
 * exatamente para o público deste app.
 *
 * `forwardRef` é obrigatório — sem repassar a ref, o react-hook-form não
 * registra o campo e o formulário envia vazio.
 */
export const Selecao = forwardRef<HTMLSelectElement, SelecaoProps>(function Selecao(
  { label, erro, ajuda, obrigatorio, placeholder, opcoes, id: idExterno, className, ...props },
  ref,
) {
  const idGerado = useId()
  const id = idExterno ?? idGerado

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {obrigatorio && (
          <span className="ml-1 text-danger" aria-hidden="true">
            *
          </span>
        )}
        {obrigatorio && <span className="sr-only"> (obrigatório)</span>}
      </label>

      <select
        ref={ref}
        id={id}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? `${id}-erro` : ajuda ? `${id}-ajuda` : undefined}
        className={cn(
          'min-h-12 w-full rounded-xl border bg-surface px-3.5 text-base text-ink',
          erro ? 'border-danger' : 'border-border-strong focus:border-brand-600',
          className,
        )}
        {...props}
      >
        <option value="">{placeholder}</option>
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>

      {ajuda && !erro && (
        <p id={`${id}-ajuda`} className="text-sm text-ink-muted">
          {ajuda}
        </p>
      )}
      {erro && (
        <p id={`${id}-erro`} role="alert" className="text-sm text-danger">
          {erro}
        </p>
      )}
    </div>
  )
})
