import type { ReactNode } from 'react'
import { AlertTriangle, Inbox, Loader2, WifiOff } from 'lucide-react'
import { ApiError, OfflineError } from '@/shared/api/client'
import { cn } from '@/shared/lib/cn'
import { Button } from './Button'

/**
 * Os cinco estados que toda lista do MNVMA precisa ter desenhados:
 * carregando, vazio, erro, offline e sem permissão.
 *
 * Estão juntos num arquivo de propósito — quando ficam espalhados, alguém
 * inevitavelmente esquece um deles e a tela fica em branco sem explicação.
 */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded-lg bg-surface-muted', className)}
      aria-hidden="true"
    />
  )
}

/** Esqueleto no formato do conteúdo real — não um spinner de tela cheia. */
export function ListaSkeleton({ linhas = 5 }: { linhas?: number }) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Carregando">
      {Array.from({ length: linhas }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-card border border-border bg-surface p-4"
        >
          <Skeleton className="size-11 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
      <span className="sr-only">Carregando informações…</span>
    </div>
  )
}

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12" role="status">
      <Loader2 className="size-8 animate-spin text-brand-700 dark:text-brand-400" aria-hidden />
      <p className="text-ink-muted">{texto}</p>
    </div>
  )
}

interface EstadoProps {
  titulo: string
  descricao?: string
  icone?: ReactNode
  acao?: { rotulo: string; onClick: () => void }
  className?: string
}

function EstadoBase({ titulo, descricao, icone, acao, className }: EstadoProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-card border border-dashed',
        'border-border-strong bg-surface px-6 py-12 text-center',
        className,
      )}
    >
      {icone}
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-ink">{titulo}</h3>
        {descricao && <p className="max-w-prose text-ink-muted">{descricao}</p>}
      </div>
      {acao && (
        <Button variante="primary" onClick={acao.onClick} className="mt-2">
          {acao.rotulo}
        </Button>
      )}
    </div>
  )
}

export function EstadoVazio(props: Omit<EstadoProps, 'icone'>) {
  return (
    <EstadoBase
      {...props}
      icone={<Inbox className="size-10 text-ink-subtle" aria-hidden="true" />}
    />
  )
}

/**
 * Nem toda falha é a mesma falha.
 *
 * "Não conseguimos carregar, tente de novo" está certo para um 500, mas mente
 * para os outros dois casos que aparecem de verdade no dia a dia: sem internet
 * (tentar de novo agora não adianta) e cota de requisições estourada (tentar de
 * novo é justamente o que piora). Passar o `erro` faz a tela dizer qual é.
 */
function descreverFalha(erro: unknown): { titulo: string; descricao: string; insistir: boolean } {
  if (erro instanceof OfflineError) {
    return {
      titulo: 'Você está sem conexão',
      descricao: 'Assim que a internet voltar, atualizamos sozinho.',
      insistir: false,
    }
  }

  if (erro instanceof ApiError && erro.isMuitasRequisicoes) {
    const segundos = erro.segundosParaTentar
    return {
      titulo: 'Muitas ações em pouco tempo',
      descricao: segundos
        ? `O servidor pediu uma pausa. Tente de novo em ${segundos} segundos.`
        : 'O servidor pediu uma pausa. Tente de novo em alguns segundos.',
      insistir: false,
    }
  }

  if (erro instanceof ApiError && erro.status >= 400 && erro.status < 500) {
    return { titulo: 'Não foi possível carregar', descricao: erro.message, insistir: true }
  }

  return {
    titulo: 'Não conseguimos carregar',
    descricao: 'Tente de novo em alguns instantes.',
    insistir: true,
  }
}

export function EstadoErro({
  titulo,
  descricao,
  erro,
  aoTentarNovamente,
}: {
  titulo?: string
  descricao?: string
  /** A falha que veio da query. Sem ela, o texto é o genérico de sempre. */
  erro?: unknown
  aoTentarNovamente?: () => void
}) {
  const detalhe = descreverFalha(erro)

  return (
    <EstadoBase
      titulo={titulo ?? detalhe.titulo}
      descricao={descricao ?? detalhe.descricao}
      icone={<AlertTriangle className="size-10 text-warning" aria-hidden="true" />}
      acao={
        aoTentarNovamente && detalhe.insistir
          ? { rotulo: 'Tentar novamente', onClick: aoTentarNovamente }
          : undefined
      }
    />
  )
}

export function EstadoOffline({ aoTentarNovamente }: { aoTentarNovamente?: () => void }) {
  return (
    <EstadoBase
      titulo="Você está sem conexão"
      descricao="Mostramos o que já estava salvo no aparelho. Assim que a internet voltar, atualizamos."
      icone={<WifiOff className="size-10 text-ink-subtle" aria-hidden="true" />}
      acao={aoTentarNovamente ? { rotulo: 'Tentar de novo', onClick: aoTentarNovamente } : undefined}
    />
  )
}

export function SemPermissao() {
  return (
    <EstadoBase
      titulo="Você não tem acesso a esta área"
      descricao="Fale com quem administra a conta se precisar deste acesso."
      icone={<AlertTriangle className="size-10 text-ink-subtle" aria-hidden="true" />}
    />
  )
}
