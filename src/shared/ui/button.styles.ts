import { cn } from '@/shared/lib/cn'

export type Variante = 'primary' | 'secondary' | 'ghost' | 'danger'
export type Tamanho = 'sm' | 'md' | 'lg'

export const VARIANTES: Record<Variante, string> = {
  primary:
    'bg-brand-700 text-white hover:bg-brand-800 active:bg-brand-900 ' +
    'dark:bg-brand-500 dark:text-brand-950 dark:hover:bg-brand-400',
  secondary:
    'bg-surface text-ink border border-border-strong ' +
    'hover:bg-surface-muted active:bg-surface-muted',
  ghost: 'text-ink-muted hover:bg-surface-muted hover:text-ink',
  danger: 'bg-danger text-white hover:opacity-90 active:opacity-80 dark:text-danger-soft',
}

export const TAMANHOS: Record<Tamanho, string> = {
  // Nenhum tamanho abaixo de 44px de altura: é o mínimo confortável para o
  // polegar, e o público usa o app em pé, na rua, com uma mão só.
  sm: 'min-h-11 px-3 text-sm gap-1.5',
  md: 'min-h-11 px-4 text-base gap-2',
  lg: 'min-h-13 px-6 text-lg gap-2.5',
}

/**
 * Estilos do botão, num módulo próprio para poder aplicar num `<Link>` do
 * roteador.
 *
 * Um `<a>` dentro de `<button>` é HTML inválido e quebra a navegação por
 * teclado — quando a ação é ir para outra rota, o elemento tem que ser o link.
 * Fica separado de `Button.tsx` porque um arquivo que exporta componente e
 * função ao mesmo tempo desliga o Fast Refresh no desenvolvimento.
 */
export function estilosBotao({
  variante = 'primary',
  tamanho = 'md',
  larguraTotal = false,
  className,
}: {
  variante?: Variante
  tamanho?: Tamanho
  larguraTotal?: boolean
  className?: string
} = {}): string {
  return cn(
    'inline-flex items-center justify-center rounded-xl font-semibold',
    'transition-colors duration-200',
    VARIANTES[variante],
    TAMANHOS[tamanho],
    larguraTotal && 'w-full',
    className,
  )
}
