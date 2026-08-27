import { forwardRef, useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/shared/lib/cn'

interface BaseProps {
  label: string
  erro?: string
  ajuda?: string
  obrigatorio?: boolean
}

const CAMPO_BASE =
  'w-full min-h-12 rounded-xl border bg-surface px-3.5 py-2.5 text-base text-ink ' +
  'placeholder:text-ink-subtle transition-colors ' +
  'disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-surface-muted'

/**
 * Rótulo sempre visível, nunca placeholder no lugar de label: quando o campo é
 * preenchido o placeholder some e a pessoa perde a referência do que digitou —
 * problema real em formulário longo como o de cadastro de cliente.
 */
function Envolucro({
  id,
  label,
  erro,
  ajuda,
  obrigatorio,
  children,
}: BaseProps & { id: string; children: React.ReactNode }) {
  const idErro = `${id}-erro`
  const idAjuda = `${id}-ajuda`

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

      {children}

      {ajuda && !erro && (
        <p id={idAjuda} className="text-sm text-ink-muted">
          {ajuda}
        </p>
      )}

      {/* role="alert" para o leitor de tela anunciar o erro na hora */}
      {erro && (
        <p id={idErro} role="alert" className="flex items-start gap-1.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{erro}</span>
        </p>
      )}
    </div>
  )
}

interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement>, BaseProps {}

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(function InputField(
  { label, erro, ajuda, obrigatorio, className, id: idExterno, ...props },
  ref,
) {
  const idGerado = useId()
  const id = idExterno ?? idGerado

  return (
    <Envolucro id={id} label={label} erro={erro} ajuda={ajuda} obrigatorio={obrigatorio}>
      <input
        ref={ref}
        id={id}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? `${id}-erro` : ajuda ? `${id}-ajuda` : undefined}
        aria-required={obrigatorio || undefined}
        className={cn(
          CAMPO_BASE,
          erro ? 'border-danger' : 'border-border-strong focus:border-brand-600',
          className,
        )}
        {...props}
      />
    </Envolucro>
  )
})

interface TextareaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, BaseProps {}

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(
  function TextareaField(
    { label, erro, ajuda, obrigatorio, className, id: idExterno, rows = 4, ...props },
    ref,
  ) {
    const idGerado = useId()
    const id = idExterno ?? idGerado

    return (
      <Envolucro id={id} label={label} erro={erro} ajuda={ajuda} obrigatorio={obrigatorio}>
        <textarea
          ref={ref}
          id={id}
          rows={rows}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? `${id}-erro` : ajuda ? `${id}-ajuda` : undefined}
          className={cn(
            CAMPO_BASE,
            'resize-y leading-relaxed',
            erro ? 'border-danger' : 'border-border-strong focus:border-brand-600',
            className,
          )}
          {...props}
        />
      </Envolucro>
    )
  },
)

interface CheckboxFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
  descricao?: string
}

export const CheckboxField = forwardRef<HTMLInputElement, CheckboxFieldProps>(
  function CheckboxField({ label, descricao, className, id: idExterno, ...props }, ref) {
    const idGerado = useId()
    const id = idExterno ?? idGerado

    return (
      // O label inteiro é a área de toque — marcar um checkbox de 16px com o
      // polegar é frustrante, e aqui a linha toda funciona.
      <label
        htmlFor={id}
        className={cn(
          'flex min-h-11 cursor-pointer items-start gap-3 rounded-lg py-2 pr-2',
          'hover:bg-surface-muted transition-colors',
          className,
        )}
      >
        <input
          ref={ref}
          id={id}
          type="checkbox"
          className="mt-0.5 size-5 shrink-0 rounded border-border-strong accent-brand-700"
          {...props}
        />
        <span className="flex flex-col">
          <span className="text-base text-ink">{label}</span>
          {descricao && <span className="text-sm text-ink-muted">{descricao}</span>}
        </span>
      </label>
    )
  },
)
