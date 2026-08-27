import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/shared/lib/cn'
import { TAMANHOS, VARIANTES, type Tamanho, type Variante } from './button.styles'


interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante
  tamanho?: Tamanho
  carregando?: boolean
  iconeEsquerda?: ReactNode
  iconeDireita?: ReactNode
  larguraTotal?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variante = 'primary',
    tamanho = 'md',
    carregando = false,
    iconeEsquerda,
    iconeDireita,
    larguraTotal = false,
    className,
    disabled,
    children,
    type = 'button',
    ...props
  },
  ref,
) {
  // Botão que dispara ação assíncrona fica desabilitado enquanto ela corre:
  // sem isso, dois toques rápidos criam dois clientes.
  const inativo = disabled || carregando

  return (
    <button
      ref={ref}
      type={type}
      disabled={inativo}
      aria-busy={carregando || undefined}
      className={cn(
        'inline-flex items-center justify-center rounded-xl font-semibold',
        'transition-colors duration-200',
        'disabled:cursor-not-allowed disabled:opacity-55',
        VARIANTES[variante],
        TAMANHOS[tamanho],
        larguraTotal && 'w-full',
        className,
      )}
      {...props}
    >
      {carregando ? (
        <Loader2 className="size-5 shrink-0 animate-spin" aria-hidden="true" />
      ) : (
        iconeEsquerda
      )}
      {children}
      {!carregando && iconeDireita}
    </button>
  )
})
