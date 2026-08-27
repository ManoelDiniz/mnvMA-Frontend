import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-card border border-border bg-surface shadow-card',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({
  titulo,
  descricao,
  acao,
  className,
}: {
  titulo: ReactNode
  descricao?: ReactNode
  acao?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 px-4 pt-4 sm:px-5', className)}>
      <div className="flex flex-col gap-0.5">
        <h2 className="text-lg font-semibold text-ink">{titulo}</h2>
        {descricao && <p className="text-sm text-ink-muted">{descricao}</p>}
      </div>
      {acao}
    </div>
  )
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4 sm:p-5', className)} {...props} />
}

type TomBadge = 'neutro' | 'sucesso' | 'aviso' | 'perigo' | 'info' | 'marca'

const TONS: Record<TomBadge, string> = {
  neutro: 'bg-surface-muted text-ink-muted border-border',
  sucesso: 'bg-success-soft text-success border-transparent',
  aviso: 'bg-warning-soft text-warning border-transparent',
  perigo: 'bg-danger-soft text-danger border-transparent',
  info: 'bg-info-soft text-info border-transparent',
  marca: 'bg-brand-50 text-brand-800 border-transparent dark:bg-brand-900 dark:text-brand-100',
}

/**
 * Estado sempre com RÓTULO, nunca só com cor — daltonismo atinge cerca de 8%
 * dos homens, e "o plantão vermelho" não significa nada para eles.
 */
export function Badge({
  children,
  tom = 'neutro',
  className,
}: {
  children: ReactNode
  tom?: TomBadge
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1',
        'text-xs font-semibold whitespace-nowrap',
        TONS[tom],
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Cartão de indicador do dashboard. */
export function Indicador({
  rotulo,
  valor,
  detalhe,
  tom = 'neutro',
  icone,
}: {
  rotulo: string
  valor: ReactNode
  detalhe?: string
  tom?: TomBadge
  icone?: ReactNode
}) {
  const cor =
    tom === 'sucesso'
      ? 'text-success'
      : tom === 'perigo'
        ? 'text-danger'
        : tom === 'aviso'
          ? 'text-warning'
          : 'text-ink'

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-ink-muted">{rotulo}</p>
        {icone}
      </div>
      <p className={cn('tabular mt-2 text-2xl font-bold', cor)}>{valor}</p>
      {detalhe && <p className="mt-1 text-sm text-ink-muted">{detalhe}</p>}
    </Card>
  )
}
