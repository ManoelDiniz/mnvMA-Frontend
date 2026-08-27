import type { ReactNode } from 'react'

/**
 * Moldura das telas de entrada e cadastro.
 *
 * Uma coluna só, centralizada, sem ilustração pesada: a primeira abertura
 * costuma ser no celular, no 4G, e o que importa é o formulário aparecer rápido.
 */
export function MolduraAuth({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string
  subtitulo?: string
  children: ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface-muted px-4 pt-safe pb-8">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-8">
        <header className="mb-7 flex flex-col items-center text-center">
          <img
            src="/icons/icon-192.png"
            alt=""
            width={56}
            height={56}
            className="mb-4 size-14 rounded-2xl shadow-card"
          />
          <h1 className="text-2xl font-bold tracking-tight text-ink">{titulo}</h1>
          {subtitulo && <p className="mt-1.5 text-ink-muted">{subtitulo}</p>}
        </header>

        <div className="rounded-card border border-border bg-surface p-5 shadow-card sm:p-6">
          {children}
        </div>
      </main>

      <footer className="text-center text-sm text-ink-subtle">
        MNVMA · gestão para cuidadores
      </footer>
    </div>
  )
}
